/**
 * Coordinate systems, topocentric Az/El <-> Cartesian vectors, and
 * South Polar Stereographic projections (PDS LOLA DSMAP_POLAR).
 */

import {
  AOI_DIM,
  AOI_LINE_START,
  AOI_SAMPLE_START,
  LOLA_FULL_GRID_N,
  LOLA_MAP_SCALE_M,
  R_MOON_M,
  Vec3,
} from './types';

const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * Converts topocentric Azimuth (0°=North, 90°=East) and Elevation (0°=Horizon, +90°=Zenith)
 * into a unit 3D vector in RegolithForge's scene frame: -Z = North, +X = East, +Y = Up.
 */
export function azElToVector(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * DEG_TO_RAD;
  const el = elDeg * DEG_TO_RAD;
  const cosEl = Math.cos(el);
  return {
    x: cosEl * Math.sin(az),
    y: Math.sin(el),
    z: -cosEl * Math.cos(az),
  };
}

/**
 * Inverse of azElToVector: converts a 3D direction vector (-Z=North, +X=East, +Y=Up)
 * back to Azimuth [0, 360) and Elevation [-90, +90] in degrees.
 */
export function vectorToAzEl(x: number, y: number, z: number): { azDeg: number; elDeg: number } {
  const len = Math.hypot(x, y, z);
  if (len === 0) {
    return { azDeg: 0, elDeg: 0 };
  }
  const elDeg = Math.asin(Math.max(-1, Math.min(1, y / len))) * RAD_TO_DEG;
  let azDeg = Math.atan2(x, -z) * RAD_TO_DEG;
  azDeg = ((azDeg % 360) + 360) % 360;
  return { azDeg, elDeg };
}

/**
 * Forward South Polar Stereographic projection matching NASA PDS DSMAP_POLAR.
 * Returns 1-based full-grid coordinates (i = sample, j = line).
 */
export function latLonToFullGridIJ(latDeg: number, lonDeg: number): { i: number; j: number } {
  const r = 2.0 * R_MOON_M * Math.tan(((latDeg + 90.0) * DEG_TO_RAD) / 2.0);
  const lonRad = lonDeg * DEG_TO_RAD;
  const x = r * Math.sin(lonRad);
  const y = r * Math.cos(lonRad);
  const i = LOLA_FULL_GRID_N / 2.0 + 0.5 + x / LOLA_MAP_SCALE_M;
  const j = LOLA_FULL_GRID_N / 2.0 + 0.5 - y / LOLA_MAP_SCALE_M;
  return { i, j };
}

/**
 * Inverse South Polar Stereographic projection from full-grid (i, j) to (lat, lon).
 */
export function fullGridIJToLatLon(i: number, j: number): { latDeg: number; lonDeg: number } {
  const x = (i - LOLA_FULL_GRID_N / 2.0 - 0.5) * LOLA_MAP_SCALE_M;
  const y = (j - LOLA_FULL_GRID_N / 2.0 - 0.5) * LOLA_MAP_SCALE_M * -1.0;
  const r = Math.hypot(x, y);
  if (r === 0) {
    return { latDeg: -90.0, lonDeg: 0.0 };
  }
  let lonDeg = Math.atan2(x, y) * RAD_TO_DEG;
  lonDeg = ((lonDeg % 360) + 360) % 360;
  const latDeg = -90.0 + 2.0 * Math.atan((0.5 * r) / R_MOON_M) * RAD_TO_DEG;
  return { latDeg, lonDeg };
}

/**
 * Converts local AOI pixel coordinates (0..1023) to geographic (lat, lon).
 */
export function localPixelToLatLon(px: number, py: number): { latDeg: number; lonDeg: number } {
  return fullGridIJToLatLon(AOI_SAMPLE_START + px + 1, AOI_LINE_START + py + 1);
}

/**
 * Converts geographic (lat, lon) to local AOI pixel coordinates (0..1023).
 */
export function latLonToLocalPixel(latDeg: number, lonDeg: number): { px: number; py: number } {
  const { i, j } = latLonToFullGridIJ(latDeg, lonDeg);
  return {
    px: i - AOI_SAMPLE_START - 1,
    py: j - AOI_LINE_START - 1,
  };
}

/**
 * Converts Three.js world coordinates (centered at AOI center, 1 unit = 1 m, +X East-ish, +Z South-ish)
 * to local AOI pixel coordinates (0..AOI_DIM-1).
 */
export function worldMetersToLocalPixel(worldX: number, worldZ: number): { px: number; py: number } {
  const halfSpan = (AOI_DIM * LOLA_MAP_SCALE_M) / 2.0;
  return {
    px: (worldX + halfSpan) / LOLA_MAP_SCALE_M,
    py: (worldZ + halfSpan) / LOLA_MAP_SCALE_M,
  };
}

/**
 * Converts local AOI pixel coordinates to Three.js world coordinates (meters from AOI center).
 */
export function localPixelToWorldMeters(px: number, py: number): { worldX: number; worldZ: number } {
  const halfSpan = (AOI_DIM * LOLA_MAP_SCALE_M) / 2.0;
  return {
    worldX: px * LOLA_MAP_SCALE_M - halfSpan,
    worldZ: py * LOLA_MAP_SCALE_M - halfSpan,
  };
}

/**
 * Computes polar stereographic grid convergence angle gamma (degrees).
 * Because meridians converge at the South Pole, true geographic North rotates relative
 * to grid +Y (-J) by gamma = lon - centerLon (0°).
 */
export function gridConvergenceDeg(lonDeg: number, centerLonDeg = 0.0): number {
  let gamma = lonDeg - centerLonDeg;
  gamma = ((((gamma + 180) % 360) + 360) % 360) - 180;
  return gamma;
}

/**
 * Converts a true topocentric azimuth (from JPL Horizons) to DEM grid azimuth
 * accounting for polar stereographic meridian convergence.
 */
export function trueAzToGridAz(trueAzDeg: number, lonDeg: number, centerLonDeg = 0.0): number {
  const gamma = gridConvergenceDeg(lonDeg, centerLonDeg);
  return (((trueAzDeg - gamma) % 360) + 360) % 360;
}
