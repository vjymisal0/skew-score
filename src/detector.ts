import sharp from 'sharp';
import type { SkewOptions, SkewResult, SkewDetails } from './types.js';

export function normalizeOptions(options?: SkewOptions): Required<SkewOptions> {
  return {
    angleThreshold: options?.angleThreshold ?? 3.0,
    minConfidence: options?.minConfidence ?? 0.20,
    maxAngle: options?.maxAngle ?? 45,
    angleStep: options?.angleStep ?? 0.5,
    downsampleWidth: options?.downsampleWidth ?? 400
  };
}

/**
 * Computes horizontal projection profile variance at a specific rotation angle.
 * When text lines or document edges are aligned horizontally, the variance of row sums is maximized.
 */
function evaluateProjectionVariance(
  edgeMap: Uint8Array,
  width: number,
  height: number,
  angleDegrees: number
): number {
  const rad = (angleDegrees * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  const cx = width / 2;
  const cy = height / 2;

  // Project onto vertical axis (row projection)
  // Bounded buffer for projected row sums
  const projectedRows = new Float64Array(height);
  const countPerBin = new Int32Array(height);

  for (let y = 0; y < height; y++) {
    const dy = y - cy;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const val = edgeMap[rowOffset + x]!;
      if (val === 0) continue;

      const dx = x - cx;
      // Rotated Y coordinate: -dx * sin + dy * cos + cy
      const rotY = Math.round(-dx * sin + dy * cos + cy);

      if (rotY >= 0 && rotY < height) {
        projectedRows[rotY] += val;
        countPerBin[rotY] += 1;
      }
    }
  }

  // Calculate variance of non-empty bins
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let i = 0; i < height; i++) {
    if (countPerBin[i]! > 0) {
      const val = projectedRows[i]!;
      sum += val;
      sumSq += val * val;
      count++;
    }
  }

  if (count <= 1) return 0;
  const mean = sum / count;
  return (sumSq / count) - (mean * mean);
}

/**
 * Analyzes document and text skew using Radon / Horizontal Projection Profile variance.
 *
 * @param input - File path, Buffer, or Uint8Array representing an image.
 * @param options - Configurable parameters.
 * @returns Promise resolving to a SkewResult.
 */
export async function analyzeSkew(
  input: string | Buffer | Uint8Array,
  options?: SkewOptions
): Promise<SkewResult> {
  const opts = normalizeOptions(options);

  // Load image, grayscale, downsample
  const { data: rawGray, info } = await sharp(input)
    .resize({ width: opts.downsampleWidth, withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const totalPixels = width * height;

  if (totalPixels === 0) {
    throw new Error('Image contains no pixel data.');
  }

  // Fast Sobel horizontal edge filtering (horizontal edges are most sensitive to tilt)
  const edges = new Uint8Array(totalPixels);
  for (let y = 1; y < height - 1; y++) {
    const rPrev = (y - 1) * width;
    const rCurr = y * width;
    const rNext = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      // Sobel Y (horizontal gradients)
      const gy =
        -(rawGray[rPrev + x - 1]! + 2 * rawGray[rPrev + x]! + rawGray[rPrev + x + 1]!) +
        (rawGray[rNext + x - 1]! + 2 * rawGray[rNext + x]! + rawGray[rNext + x + 1]!);

      const mag = Math.abs(gy);
      // Threshold edges to binary structure
      edges[rCurr + x] = mag > 45 ? 255 : 0;
    }
  }

  // Angular sweep to find peak variance
  let bestAngle = 0;
  let maxVariance = -1;
  let minVariance = Infinity;
  let zeroAngleVariance = 0;

  const startAngle = -opts.maxAngle;
  const endAngle = opts.maxAngle;
  const step = opts.angleStep;

  const variances: { angle: number; variance: number }[] = [];

  for (let angle = startAngle; angle <= endAngle; angle += step) {
    const roundedAngle = Math.round(angle * 100) / 100;
    const variance = evaluateProjectionVariance(edges, width, height, roundedAngle);

    variances.push({ angle: roundedAngle, variance });

    if (roundedAngle === 0) {
      zeroAngleVariance = variance;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = roundedAngle;
    }
    if (variance < minVariance) {
      minVariance = variance;
    }
  }

  // Compute confidence based on contrast between peak variance and baseline variance
  const baseline = (minVariance === Infinity || minVariance < 0) ? 0 : minVariance;
  const peakContrast = maxVariance > baseline && baseline > 0
    ? (maxVariance - baseline) / maxVariance
    : 0;

  const confidence = Number(Math.min(1.0, Math.max(0.0, peakContrast)).toFixed(3));

  // If confidence is too low (e.g. blank page or uniform texture), assume 0 skew
  const finalAngle = confidence >= opts.minConfidence ? bestAngle : 0;
  const absAngle = Math.abs(finalAngle);

  // Normalized score (0.0 = 0 deg, 1.0 = 45+ deg)
  const score = Number(Math.min(1.0, absAngle / 45).toFixed(4));
  const isSkewed = absAngle >= opts.angleThreshold;

  // Corrective rotation is opposite of detected angle
  const correctiveRotation = finalAngle === 0 ? 0 : Number((-finalAngle).toFixed(2));

  let quality: 'straight' | 'slight-tilt' | 'moderate-skew' | 'severe-skew';
  if (absAngle < 1.0) {
    quality = 'straight';
  } else if (absAngle <= opts.angleThreshold) {
    quality = 'slight-tilt';
  } else if (absAngle <= 15.0) {
    quality = 'moderate-skew';
  } else {
    quality = 'severe-skew';
  }

  const details: SkewDetails = {
    angle: finalAngle,
    confidence,
    width,
    height
  };

  return {
    angle: finalAngle,
    score,
    isSkewed,
    confidence,
    correctiveRotation,
    quality,
    details
  };
}

/**
 * Returns only the detected skew angle in degrees.
 */
export async function getSkewAngle(
  input: string | Buffer | Uint8Array,
  options?: SkewOptions
): Promise<number> {
  const res = await analyzeSkew(input, options);
  return res.angle;
}

/**
 * Returns true if the image exceeds the skew threshold.
 */
export async function isSkewed(
  input: string | Buffer | Uint8Array,
  threshold?: number
): Promise<boolean> {
  const options: SkewOptions = {};
  if (threshold !== undefined) {
    options.angleThreshold = threshold;
  }
  const res = await analyzeSkew(input, options);
  return res.isSkewed;
}
