/**
 * Core physical constants and domain types for RegolithForge.
 * Pure TypeScript — zero React or Three.js dependencies.
 */

export const R_MOON_M = 1_737_400.0;
export const SOLAR_CONSTANT_W_M2 = 1_361.0;
export const SOLAR_ANGULAR_RADIUS_DEG = 0.2665; // 0.533° diameter / 2
export const SPEED_OF_LIGHT_M_S = 299_792_458.0;
export const AU_IN_METERS = 149_597_870_700.0;
export const LUNAR_GRAVITY_M_S2 = 1.625;

// Full LOLA LDEM_875S_20M grid constants (7584 x 7584 @ 20 m/px)
export const LOLA_FULL_GRID_N = 7584;
export const LOLA_MAP_SCALE_M = 20.0;

// Default AOI slice bounds within the full LOLA grid
export const AOI_SAMPLE_START = 3038;
export const AOI_LINE_START = 3538;
export const AOI_DIM = 1024;

export type ProvenanceTag = 'REAL' | 'DERIVED' | 'SYNTHETIC';

export type SolarArrayModel = 'vertical' | 'horizontal' | 'dual';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface EphemerisStep {
  step_index: number;
  utc_time: string;
  sun: {
    azimuth_deg: number;
    elevation_deg: number;
    heliocentric_distance_au: number;
  };
  earth: {
    azimuth_deg: number;
    elevation_deg: number;
    range_km: number;
    light_time_seconds: number;
    fspl_x_band_db: number;
    fspl_s_band_db: number;
    candidate_dsn_complex: string;
  };
}

export interface HorizonResult {
  /** 360-element array for azimuths 0°..359° (degrees above local horizontal) */
  maskDeg: Float32Array;
  mastHeightM: number;
  includeCurvature: boolean;
}

export interface DteStepResult {
  visible: boolean;
  label: 'Geometric LOS (unobstructed terrain vector)';
  earthElDeg: number;
  horizonElDeg: number;
  marginDeg: number;
  rangeKm: number;
  lightTimeS: number;
  fsplXBandDb: number;
  dsnComplex: string;
}

export interface SiteWeights {
  slope: number;
  illumination: number;
  dte: number;
  iceProximity: number;
}

export interface SiteScoreBreakdown {
  totalScore: number; // 0..100
  slopeScore: number;
  illuminationScore: number;
  dteScore: number;
  iceScore: number;
  feasible: boolean;
  disqualificationReason?: string;
}

export interface GridPoint {
  px: number;
  py: number;
}

export interface TraverseOptions {
  maxSlopeDeg: number;
  roverMassKg: number;
  rollingResistance: number;
  /** Optional illumination fraction grid (0..1) for illumination-aware routing */
  illuminationGrid?: Float32Array;
  illuminationPenaltyWeight?: number;
}

export interface TraverseResult {
  found: boolean;
  path: GridPoint[];
  totalDistanceM: number;
  totalEnergyWh: number;
  maxSlopeEncounteredDeg: number;
  estimatedTimeHours: number;
  sunlitFraction: number;
}
