# skew-score

[![npm version](https://img.shields.io/npm/v/skew-score.svg?style=flat-square)](https://www.npmjs.com/package/skew-score)
[![CI](https://github.com/vjymisal0/skew-score/actions/workflows/ci.yml/badge.svg)](https://github.com/vjymisal0/skew-score/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/skew-score.svg?style=flat-square)](https://github.com/vjymisal0/skew-score/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org)
[![Downloads](https://img.shields.io/npm/dm/skew-score.svg?style=flat-square)](https://www.npmjs.com/package/skew-score)

> Measure document and image tilt (-45° to +45°) with Radon projection-profile analysis via [Sharp](https://sharp.pixelplumbing.com). Built for pre-OCR document scanning, KYC ID capture and receipt processing.

## Why skew-score?

When people photograph ID cards (PAN, Aadhaar, driving licences), cheques or receipts on a phone, a few degrees of tilt is enough to hurt OCR accuracy. `skew-score` tells you:

- **The tilt angle**, accurate to the search step (0.5° by default)
- **The corrective rotation** to pass straight to `sharp().rotate()`
- **A severity score** from 0.0 (aligned) to 1.0 (45° or more)
- **A confidence value**, so blank or featureless images are not reported as tilted

Ships ESM + CommonJS builds with TypeScript types. Companion to [`blur-score`](https://www.npmjs.com/package/blur-score), [`exposure-score`](https://www.npmjs.com/package/exposure-score), [`glare-score`](https://www.npmjs.com/package/glare-score), [`contrast-score`](https://www.npmjs.com/package/contrast-score) and [`shadow-score`](https://www.npmjs.com/package/shadow-score).

## Installation

```bash
npm install skew-score
# pnpm add skew-score
# yarn add skew-score
```

Requires Node.js 20.9 or newer. `sharp` is installed as a dependency.

## Quick start

```typescript
import { analyzeSkew } from 'skew-score';

const result = await analyzeSkew('path/to/document.jpg');
/*
{
  angle: 8.5,
  score: 0.1889,
  isSkewed: true,
  confidence: 0.81,
  correctiveRotation: -8.5,
  quality: 'moderate-skew',
  details: { angle: 8.5, confidence: 0.81, width: 400, height: 260 }
}
*/
```

### Straighten a document

```typescript
import sharp from 'sharp';
import { analyzeSkew } from 'skew-score';

const result = await analyzeSkew(imageBuffer);
if (result.isSkewed && result.confidence > 0.5) {
  const straightened = await sharp(imageBuffer)
    .rotate(result.correctiveRotation, { background: '#ffffff' })
    .toBuffer();
}
```

### Quick helpers

```typescript
import { getSkewAngle, isSkewed } from 'skew-score';

const angle = await getSkewAngle(buffer); // e.g. -4.5

if (await isSkewed(buffer)) {
  console.log('Please hold the camera level with your document.');
}

await isSkewed(buffer, 5); // custom threshold in degrees
```

## API

### `analyzeSkew(input, options?): Promise<SkewResult>`

`input` is a file path, `Buffer` or `Uint8Array` in any format Sharp can read (JPEG, PNG, WebP, TIFF, AVIF, …).

| Field | Type | Description |
| --- | --- | --- |
| `angle` | `number` | Detected tilt in degrees. Positive means the content is rotated clockwise (the same convention as `sharp().rotate()`). `0` when confidence is below `minConfidence`. |
| `score` | `number` | `abs(angle) / 45`, clamped to 0–1. |
| `isSkewed` | `boolean` | `true` when `abs(angle)` is greater than `angleThreshold`. |
| `confidence` | `number` | 0–1. How strongly the best angle stands out from the others. `0` for blank or featureless images. |
| `correctiveRotation` | `number` | Degrees to pass to `sharp().rotate()` to straighten the image (`-angle`). |
| `quality` | `string` | `'straight'` (< 1°), `'slight-tilt'` (up to `angleThreshold`), `'moderate-skew'` (up to 15°) or `'severe-skew'`. |
| `details` | `SkewDetails` | `angle`, `confidence`, and the `width`/`height` actually analyzed after downsampling. |

### `getSkewAngle(input, options?): Promise<number>`

Returns only `angle`.

### `isSkewed(input, threshold?): Promise<boolean>`

Returns `isSkewed` using `threshold` (degrees, default `3`).

### `SkewOptions`

| Option | Default | Valid range | Description |
| --- | --- | --- | --- |
| `angleThreshold` | `3` | `>= 0` | Tilt above which `isSkewed` is `true`. |
| `minConfidence` | `0.2` | `0`–`1` | Below this, `angle` is reported as `0`. |
| `maxAngle` | `45` | `> 0`, `<= 90` | Search range is `[-maxAngle, +maxAngle]`. |
| `angleStep` | `0.5` | `> 0`, `<= maxAngle` | Search resolution in degrees. Smaller is more precise and slower. |
| `downsampleWidth` | `400` | integer `>= 16` | Images wider than this are resized before analysis. Smaller images are never enlarged. |

Invalid options throw a `RangeError`. Unreadable input rejects with Sharp's error.

## How it works

1. The image is downsampled, converted to grayscale, and run through a vertical Sobel filter so horizontal edges (text baselines, document borders) stand out.
2. For each candidate angle, edge pixels are projected onto a rotated vertical axis (a Radon transform at that angle).
3. When the projection axis matches the document's lines, edge energy collapses into a few sharp peaks. That maximizes the variance of the projection profile.
4. The angle with the highest variance wins. Confidence is how far that peak sits above the weakest angle.

## Limitations

- It needs line structure: text, ruled lines or document edges. Photos without dominant horizontal features get low confidence and report `0`.
- It measures in-plane rotation only, not perspective (keystone) distortion.
- Rotations beyond ±45° are ambiguous for line-based content (a 90° turn looks straight). Use EXIF orientation or a separate orientation check for those.

## Development

```bash
npm install
npm test          # vitest
npm run typecheck
npm run build     # tsup → dist/ (ESM + CJS + .d.ts)
```

## License

MIT © [Vijay Misal](https://github.com/vjymisal0)
