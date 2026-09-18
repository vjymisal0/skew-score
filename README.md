# skew-score

> Quantifies document and image tilt/skew angle (-45° to +45°) using Radon projection profile variance analysis via Sharp. Optimized for pre-OCR document scanning, KYC ID verification, and receipt processing.

[![npm version](https://img.shields.io/npm/v/skew-score.svg)](https://www.npmjs.com/package/skew-score)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why skew-score?

When users photograph identification cards (PAN, Aadhaar, Driver Licenses), checks, or receipts with mobile cameras, angular tilt and perspective skew degrade OCR accuracy by up to 60%.

`skew-score` runs an ultra-fast angular sweep across directional edge projections to accurately compute:
- **Exact tilt angle** (-45.0° to +45.0°)
- **Corrective rotation** required to straighten the image
- **Skew severity score** (0.0 = aligned, 1.0 = heavily tilted)

Companion to [`blur-score`](https://www.npmjs.com/package/blur-score), [`exposure-score`](https://www.npmjs.com/package/exposure-score), [`glare-score`](https://www.npmjs.com/package/glare-score), and [`contrast-score`](https://www.npmjs.com/package/contrast-score).

## Installation

```bash
npm install skew-score sharp
# or
pnpm add skew-score sharp
```

## Usage

### 1. Analyze Skew

```typescript
import { analyzeSkew } from 'skew-score';

const result = await analyzeSkew('path/to/document.jpg');
console.log(result);
/*
{
  angle: -8.5,
  score: 0.1889,
  isSkewed: true,
  confidence: 0.84,
  correctiveRotation: 8.5,
  quality: 'moderate-skew',
  details: {
    angle: -8.5,
    confidence: 0.84,
    width: 400,
    height: 260
  }
}
*/
```

### 2. Quick Helpers

```typescript
import { getSkewAngle, isSkewed } from 'skew-score';

// Get just the rotation angle
const angle = await getSkewAngle(buffer); // e.g. -4.2

// Check if tilted beyond threshold (default 3 degrees)
if (await isSkewed(buffer)) {
  console.log('Please hold the camera level with your document.');
}
```

### 3. Straightening the Document

```typescript
import sharp from 'sharp';
import { analyzeSkew } from 'skew-score';

const result = await analyzeSkew(imageBuffer);
if (result.isSkewed && result.confidence > 0.5) {
  const deskewedBuffer = await sharp(imageBuffer)
    .rotate(result.correctiveRotation, { background: '#ffffff' })
    .toBuffer();
}
```

## Options

```typescript
interface SkewOptions {
  /** Maximum allowed tilt before flagging as skewed (default: 3.0 degrees) */
  angleThreshold?: number;
  /** Minimum confidence required to accept angle (default: 0.20) */
  minConfidence?: number;
  /** Maximum angle search range (default: 45) */
  maxAngle?: number;
  /** Angular search step resolution (default: 0.5 degrees) */
  angleStep?: number;
  /** Downsample width for fast processing (default: 400px) */
  downsampleWidth?: number;
}
```

## License

MIT © [Vijay Misal](https://github.com/vjymisal0)
