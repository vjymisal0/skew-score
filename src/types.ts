export interface SkewDetails {
  /**
   * Detected skew angle in degrees (negative = counter-clockwise, positive = clockwise).
   */
  angle: number;

  /**
   * Confidence of the detected angle from 0.0 to 1.0.
   */
  confidence: number;

  /**
   * Width of the analyzed image after optional downsampling.
   */
  width: number;

  /**
   * Height of the analyzed image after optional downsampling.
   */
  height: number;
}

export interface SkewOptions {
  /**
   * Maximum allowed absolute tilt angle in degrees before flagging as skewed.
   * @default 3.0
   */
  angleThreshold?: number;

  /**
   * Minimum confidence score (0.0 to 1.0) required to consider skew detection valid.
   * @default 0.20
   */
  minConfidence?: number;

  /**
   * Search range of angles to inspect in degrees [-range, +range].
   * @default 45
   */
  maxAngle?: number;

  /**
   * Step size in degrees during angular projection search.
   * @default 0.5
   */
  angleStep?: number;

  /**
   * Target width to resize the image for blazing fast analysis.
   * @default 400
   */
  downsampleWidth?: number;
}

export interface SkewResult {
  /**
   * Detected skew angle in degrees (-45° to +45°).
   */
  angle: number;

  /**
   * Normalized skew severity score from 0.0 (perfectly straight) to 1.0 (heavily rotated).
   */
  score: number;

  /**
   * True if absolute angle exceeds angleThreshold.
   */
  isSkewed: boolean;

  /**
   * Confidence level of detection (0.0 to 1.0).
   */
  confidence: number;

  /**
   * Suggested rotation angle (in degrees) needed to de-skew / straighten the image.
   */
  correctiveRotation: number;

  /**
   * Qualitative alignment rating.
   */
  quality: 'straight' | 'slight-tilt' | 'moderate-skew' | 'severe-skew';

  /**
   * Optional granular diagnostics.
   */
  details?: SkewDetails;
}
