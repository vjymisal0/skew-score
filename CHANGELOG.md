# Changelog

## 1.1.0

### Fixed

- Perfectly aligned documents reported `confidence: 0` and could be reported as tilted by ±0.5°. The projection profile now uses diagonal-sized bins and takes the variance over all bins, so detection is exact across the full ±45° range and straightened images come back to 0°.
- `angleStep: 0` or a negative step caused an infinite loop. All options are now validated and invalid values throw a `RangeError`.
- `isSkewed` was `true` at exactly `angleThreshold` while `quality` said `'slight-tilt'`. It is now `true` only when the angle exceeds the threshold, as documented.
- Documented `minConfidence` default corrected to `0.2`.

### Changed

- Upgraded Sharp to 0.35.5.
- Raised the minimum supported Node.js version to 20.9 (Node 18 is end-of-life).
- Upgraded dev tooling (Vitest 5, TypeScript 5.9, tsup 8.5) and resolved all audit advisories.
- Expanded the test suite from 3 to 37 tests and rewrote the README with a full API reference.
- Added CI (Node 22 and 24, plus a Node 20 smoke test of the packed package) and a tag-driven release workflow with npm provenance.

## 1.0.0

- Initial release.
