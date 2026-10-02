import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeSkew, getSkewAngle, isSkewed } from '../src/index.js';

/** Synthetic document: white page with dark horizontal text-like lines. */
async function makeDocument(width = 400, height = 300): Promise<Buffer> {
  const raw = Buffer.alloc(width * height, 255);
  for (let y = 30; y < height - 30; y += 18) {
    for (let yy = y; yy < y + 5; yy++) {
      for (let x = 40; x < width - 40; x++) {
        raw[yy * width + x] = 0;
      }
    }
  }
  return sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

function rotate(input: Buffer, degrees: number): Promise<Buffer> {
  return sharp(input).rotate(degrees, { background: '#ffffff' }).png().toBuffer();
}

let documentImage: Buffer;
let blankImage: Buffer;

beforeAll(async () => {
  documentImage = await makeDocument();
  blankImage = await sharp({
    create: { width: 120, height: 90, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).png().toBuffer();
});

describe('analyzeSkew', () => {
  it('reports a straight document as straight with high confidence', async () => {
    const result = await analyzeSkew(documentImage);
    expect(result.angle).toBe(0);
    expect(result.score).toBe(0);
    expect(result.isSkewed).toBe(false);
    expect(result.quality).toBe('straight');
    expect(result.correctiveRotation).toBe(0);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it.each([-30, -12, -5, -2, 2, 5, 12, 30, 44])(
    'detects a %d degree rotation with the correct sign',
    async (degrees) => {
      const result = await analyzeSkew(await rotate(documentImage, degrees));
      expect(result.angle).toBeCloseTo(degrees, 0);
      expect(Math.sign(result.angle)).toBe(Math.sign(degrees));
      expect(result.correctiveRotation).toBeCloseTo(-degrees, 0);
      expect(result.confidence).toBeGreaterThan(0.5);
    }
  );

  it('produces a corrective rotation that straightens the image', async () => {
    const tilted = await rotate(documentImage, 7);
    const { correctiveRotation } = await analyzeSkew(tilted);
    const straightened = await rotate(tilted, correctiveRotation);
    expect(await getSkewAngle(straightened)).toBe(0);
  });

  it('assigns quality buckets by tilt magnitude', async () => {
    expect((await analyzeSkew(await rotate(documentImage, 2))).quality).toBe('slight-tilt');
    expect((await analyzeSkew(await rotate(documentImage, 8))).quality).toBe('moderate-skew');
    expect((await analyzeSkew(await rotate(documentImage, 25))).quality).toBe('severe-skew');
  });

  it('normalizes score so 45 degrees maps to 1', async () => {
    const result = await analyzeSkew(await rotate(documentImage, 30));
    expect(result.score).toBeCloseTo(30 / 45, 2);
  });

  it('flags skew only when the angle exceeds the threshold', async () => {
    const tilted = await rotate(documentImage, 3);
    const atThreshold = await analyzeSkew(tilted, { angleThreshold: 3 });
    expect(Math.abs(atThreshold.angle)).toBe(3);
    expect(atThreshold.isSkewed).toBe(false);
    expect(atThreshold.quality).toBe('slight-tilt');

    const belowAngle = await analyzeSkew(tilted, { angleThreshold: 2 });
    expect(belowAngle.isSkewed).toBe(true);
    expect(belowAngle.quality).toBe('moderate-skew');
  });

  it('falls back to 0 degrees on featureless images', async () => {
    const result = await analyzeSkew(blankImage);
    expect(result.angle).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.isSkewed).toBe(false);
  });

  it('ignores detections below minConfidence', async () => {
    const result = await analyzeSkew(await rotate(documentImage, 10), { minConfidence: 1 });
    expect(result.angle).toBe(0);
    expect(result.confidence).toBeLessThan(1);
  });

  it('limits the search to maxAngle', async () => {
    const result = await analyzeSkew(await rotate(documentImage, 30), { maxAngle: 10 });
    expect(Math.abs(result.angle)).toBeLessThanOrEqual(10);
  });

  it('downsamples large images and reports analyzed dimensions', async () => {
    const large = await makeDocument(1200, 900);
    const result = await analyzeSkew(large, { downsampleWidth: 300 });
    expect(result.details?.width).toBe(300);
    expect(result.details?.height).toBe(225);
    expect(result.angle).toBe(0);
  });

  it('does not enlarge images smaller than downsampleWidth', async () => {
    const result = await analyzeSkew(blankImage);
    expect(result.details?.width).toBe(120);
  });

  it('accepts Uint8Array input', async () => {
    const result = await analyzeSkew(new Uint8Array(await rotate(documentImage, 5)));
    expect(result.angle).toBeCloseTo(5, 0);
  });

  it('rejects data that is not an image', async () => {
    await expect(analyzeSkew(Buffer.from('not an image'))).rejects.toThrow();
  });
});

describe('file path input', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'skew-score-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads images from disk', async () => {
    const file = join(dir, 'tilted.png');
    await writeFile(file, await rotate(documentImage, -6));
    expect(await getSkewAngle(file)).toBeCloseTo(-6, 0);
  });
});

describe('option validation', () => {
  it.each([
    [{ angleStep: 0 }],
    [{ angleStep: -1 }],
    [{ angleStep: Number.NaN }],
    [{ angleStep: 60 }],
    [{ maxAngle: 0 }],
    [{ maxAngle: 91 }],
    [{ minConfidence: -0.1 }],
    [{ minConfidence: 1.5 }],
    [{ angleThreshold: -1 }],
    [{ angleThreshold: Number.POSITIVE_INFINITY }],
    [{ downsampleWidth: 0 }],
    [{ downsampleWidth: 100.5 }]
  ])('rejects invalid options %o', async (options) => {
    await expect(analyzeSkew(documentImage, options)).rejects.toThrow(RangeError);
  });
});

describe('helpers', () => {
  it('getSkewAngle returns the detected angle', async () => {
    expect(await getSkewAngle(blankImage)).toBe(0);
    expect(await getSkewAngle(await rotate(documentImage, 12))).toBeCloseTo(12, 0);
  });

  it('isSkewed uses the default 3 degree threshold', async () => {
    expect(await isSkewed(documentImage)).toBe(false);
    expect(await isSkewed(await rotate(documentImage, 6))).toBe(true);
  });

  it('isSkewed accepts a custom threshold', async () => {
    const tilted = await rotate(documentImage, 6);
    expect(await isSkewed(tilted, 10)).toBe(false);
    expect(await isSkewed(tilted, 4)).toBe(true);
  });
});
