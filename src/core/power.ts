/**
 * Solar radiation, extended solar disc partial illumination, and array power models.
 */

import { sampleHorizonAtAzimuth } from './horizon';
import {
  EphemerisStep,
  SOLAR_ANGULAR_RADIUS_DEG,
  SOLAR_CONSTANT_W_M2,
  SolarArrayModel,
} from './types';

const DEG_TO_RAD = Math.PI / 180.0;

/**
 * Computes the illuminated fraction f_ill in [0, 1] of the 0.533° solar disc
 * straddling the local horizon edge using exact circular segment geometry.
 */
export function computePartialIllumination(
  sunElDeg: number,
  horizonElDeg: number,
  solarRadiusDeg = SOLAR_ANGULAR_RADIUS_DEG
): number {
  const delta = sunElDeg - horizonElDeg;
  if (delta <= -solarRadiusDeg) return 0.0;
  if (delta >= solarRadiusDeg) return 1.0;

  const x = delta / solarRadiusDeg;
  return (Math.acos(-x) + x * Math.sqrt(Math.max(0, 1 - x * x))) / Math.PI;
}

/**
 * Scales the solar constant (1361 W/m^2 at 1 AU) by inverse-square heliocentric distance r.
 */
export function scaleSolarFlux(rAu: number): number {
  if (rAu <= 0) return SOLAR_CONSTANT_W_M2;
  return SOLAR_CONSTANT_W_M2 / (rAu * rAu);
}

/**
 * Computes instantaneous electrical power output (Watts) for a configured solar array model.
 */
export function computeArrayPowerWatts(
  sunElDeg: number,
  horizonElDeg: number,
  rAu: number,
  arrayModel: SolarArrayModel,
  areaM2 = 5.0,
  efficiency = 0.28
): { powerW: number; irradianceWPerM2: number; fIll: number } {
  const fIll = computePartialIllumination(sunElDeg, horizonElDeg);
  const flux = scaleSolarFlux(rAu);

  if (fIll <= 0) {
    return { powerW: 0, irradianceWPerM2: 0, fIll: 0 };
  }

  let incidenceFactor = 0;
  const elRad = sunElDeg * DEG_TO_RAD;

  if (arrayModel === 'vertical') {
    // Vertical azimuth-tracking panel: optimal for low polar Sun angles (~0°-2°)
    incidenceFactor = sunElDeg >= -SOLAR_ANGULAR_RADIUS_DEG ? Math.max(0, Math.cos(elRad)) : 0;
  } else if (arrayModel === 'horizontal') {
    // Fixed horizontal panel: suffers severe cosine loss at polar grazing angles
    incidenceFactor = Math.max(0, Math.sin(elRad));
  } else {
    // Two-axis gimbaled tracking: always normal to solar vector
    incidenceFactor = 1.0;
  }

  const irradianceWPerM2 = flux * incidenceFactor * fIll;
  const powerW = irradianceWPerM2 * areaM2 * efficiency;

  return { powerW, irradianceWPerM2, fIll };
}

export interface WindowPowerStats {
  illuminationFractionPct: number;
  cumulativeEnergyWh: number;
  peakPowerW: number;
  meanPowerW: number;
  longestDarknessHours: number;
  hourlyPowerW: Float32Array;
  hourlyIllumination: Float32Array;
}

/**
 * Evaluates solar power and illumination continuity over an entire ephemeris window.
 */
export function computeWindowPowerStats(
  horizonMaskDeg: Float32Array,
  ephemerisSteps: EphemerisStep[],
  arrayModel: SolarArrayModel,
  areaM2 = 5.0,
  efficiency = 0.28,
  stepHours = 1.0
): WindowPowerStats {
  const n = ephemerisSteps.length;
  const hourlyPowerW = new Float32Array(n);
  const hourlyIllumination = new Float32Array(n);

  let illumSum = 0;
  let energyWh = 0;
  let peakPowerW = 0;
  let currentDarkStreak = 0;
  let longestDarkStreak = 0;

  for (let i = 0; i < n; i++) {
    const step = ephemerisSteps[i];
    const horizEl = sampleHorizonAtAzimuth(horizonMaskDeg, step.sun.azimuth_deg);
    const { powerW, fIll } = computeArrayPowerWatts(
      step.sun.elevation_deg,
      horizEl,
      step.sun.heliocentric_distance_au,
      arrayModel,
      areaM2,
      efficiency
    );

    hourlyPowerW[i] = powerW;
    hourlyIllumination[i] = fIll;
    illumSum += fIll;
    energyWh += powerW * stepHours;
    if (powerW > peakPowerW) peakPowerW = powerW;

    if (fIll <= 0.01) {
      currentDarkStreak += stepHours;
      if (currentDarkStreak > longestDarkStreak) {
        longestDarkStreak = currentDarkStreak;
      }
    } else {
      currentDarkStreak = 0;
    }
  }

  return {
    illuminationFractionPct: n > 0 ? (illumSum / n) * 100.0 : 0,
    cumulativeEnergyWh: energyWh,
    peakPowerW,
    meanPowerW: n > 0 ? energyWh / (n * stepHours) : 0,
    longestDarknessHours: longestDarkStreak,
    hourlyPowerW,
    hourlyIllumination,
  };
}
