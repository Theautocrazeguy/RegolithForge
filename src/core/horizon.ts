/**
 * Curvature-corrected 360° horizon raycaster for lunar south pole sites.
 * Implements h_eff(d) = h(d) - d^2 / (2 * R_MOON_M).
 */

import { trueAzToGridAz } from './azEl';
import { sampleElevation } from './slope';
import { HorizonResult, R_MOON_M } from './types';

const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * Raycasts a single azimuth direction (in grid coordinates where 0° = -Y/Up on image, 90° = +X/Right)
 * and returns the maximum horizon elevation angle (degrees).
 */
export function raycastHorizonAlongGridAzimuth(
  elev: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number,
  pixelSizeM: number,
  obsElevM: number,
  gridAzDeg: number,
  includeCurvature = true
): number {
  const rad = gridAzDeg * DEG_TO_RAD;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);

  let maxTan = -Math.tan(Math.PI / 2 - 1e-4); // ~ -90 deg
  const stepPx = 1.0;

  // March outward until exiting the DEM boundary
  for (let s = stepPx; ; s += stepPx) {
    const sx = px + s * dx;
    const sy = py + s * dy;
    if (sx < 0 || sx >= width - 1 || sy < 0 || sy >= height - 1) {
      break;
    }

    const d = s * pixelSizeM;
    const hTerrain = sampleElevation(elev, width, height, sx, sy);
    // Lunar curvature drops distant terrain relative to the observer's local tangent plane
    const curvatureDrop = includeCurvature ? (d * d) / (2.0 * R_MOON_M) : 0.0;
    const hEff = hTerrain - curvatureDrop;

    const tanAngle = (hEff - obsElevM) / d;
    if (tanAngle > maxTan) {
      maxTan = tanAngle;
    }
  }

  return Math.atan(maxTan) * RAD_TO_DEG;
}

/**
 * Computes a 360° horizon elevation mask (1° resolution, indexed by true topocentric azimuth 0°..359°).
 */
export function computeHorizonMask(
  elev: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number,
  pixelSizeM = 20.0,
  mastHeightM = 0.0,
  includeCurvature = true,
  siteLonDeg = 0.0
): HorizonResult {
  const maskDeg = new Float32Array(360);
  const obsElevM = sampleElevation(elev, width, height, px, py) + mastHeightM;

  for (let az = 0; az < 360; az++) {
    const gridAz = siteLonDeg !== 0.0 ? trueAzToGridAz(az, siteLonDeg) : az;
    maskDeg[az] = raycastHorizonAlongGridAzimuth(
      elev,
      width,
      height,
      px,
      py,
      pixelSizeM,
      obsElevM,
      gridAz,
      includeCurvature
    );
  }

  return {
    maskDeg,
    mastHeightM,
    includeCurvature,
  };
}

/**
 * Linearly interpolates the 360° horizon mask at an arbitrary true azimuth.
 */
export function sampleHorizonAtAzimuth(maskDeg: Float32Array, azDeg: number): number {
  const normAz = ((azDeg % 360) + 360) % 360;
  const a0 = Math.floor(normAz) % 360;
  const a1 = (a0 + 1) % 360;
  const frac = normAz - Math.floor(normAz);
  return maskDeg[a0] * (1 - frac) + maskDeg[a1] * frac;
}

/**
 * Direct single-ray visibility check against terrain for consistency verification
 * between 3D shadow rays and the 360° horizon mask.
 */
export function rayMarchSunVisibility(
  elev: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number,
  pixelSizeM: number,
  mastHeightM: number,
  sunTrueAzDeg: number,
  sunElDeg: number,
  includeCurvature = true,
  siteLonDeg = 0.0
): boolean {
  const obsElevM = sampleElevation(elev, width, height, px, py) + mastHeightM;
  const gridAz = siteLonDeg !== 0.0 ? trueAzToGridAz(sunTrueAzDeg, siteLonDeg) : sunTrueAzDeg;
  const horizonEl = raycastHorizonAlongGridAzimuth(
    elev,
    width,
    height,
    px,
    py,
    pixelSizeM,
    obsElevM,
    gridAz,
    includeCurvature
  );
  return sunElDeg > horizonEl;
}
