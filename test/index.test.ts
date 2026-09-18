import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { analyzeSkew, getSkewAngle, isSkewed } from '../src/index.js';

describe('skew-score unit test suite', () => {
  it('detects 0 skew on clean horizontal striped document', async () => {
    // Generate an image with horizontal black/white bars
    const width = 300;
    const height = 300;
    const raw = Buffer.alloc(width * height);
    for (let y = 0; y < height; y++) {
      const isBar = Math.floor(y / 20) % 2 === 0;
      for (let x = 0; x < width; x++) {
        raw[y * width + x] = isBar ? 255 : 0;
      }
    }

    const imgBuffer = await sharp(raw, { raw: { width, height, channels: 1 } })
      .png()
      .toBuffer();

    const result = await analyzeSkew(imgBuffer);
    expect(result.angle).toBe(0);
    expect(result.isSkewed).toBe(false);
    expect(result.quality).toBe('straight');
    expect(result.score).toBe(0);
  });

  it('detects tilted angle accurately when rotated', async () => {
    const width = 300;
    const height = 300;
    const raw = Buffer.alloc(width * height);
    for (let y = 0; y < height; y++) {
      const isBar = Math.floor(y / 15) % 2 === 0;
      for (let x = 0; x < width; x++) {
        raw[y * width + x] = isBar ? 255 : 0;
      }
    }

    // Rotate by 10 degrees
    const rotatedBuffer = await sharp(raw, { raw: { width, height, channels: 1 } })
      .rotate(10, { background: '#ffffff' })
      .png()
      .toBuffer();

    const result = await analyzeSkew(rotatedBuffer, { angleStep: 1.0 });
    // Sharp rotate clockwise (+10) means the horizontal stripes are now angled at ~10°
    expect(Math.abs(result.angle)).toBeGreaterThanOrEqual(8);
    expect(Math.abs(result.angle)).toBeLessThanOrEqual(12);
    expect(result.isSkewed).toBe(true);
  });

  it('handles helper methods getSkewAngle and isSkewed', async () => {
    const blank = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    }).png().toBuffer();

    const angle = await getSkewAngle(blank);
    expect(angle).toBe(0);

    const skewed = await isSkewed(blank);
    expect(skewed).toBe(false);
  });
});
