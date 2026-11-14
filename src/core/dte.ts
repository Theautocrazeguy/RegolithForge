/**
 * Direct-to-Earth (DTE) geometric line-of-sight and link telemetry calculations.
 * Explicitly labeled as Geometric LOS rather than a full RF link budget.
 */

import { sampleHorizonAtAzimuth } from './horizon';
import { DteStepResult, EphemerisStep, SPEED_OF_LIGHT_M_S } from './types';

/**
 * Computes Free-Space Path Loss (dB) at distance rangeKm and carrier frequency freqHz.
 */
export function computeFreeSpacePathLossDb(rangeKm: number, freqHz = 8.4e9): number {
  const dMeters = rangeKm * 1000.0;
  if (dMeters <= 0 || freqHz <= 0) return 0;
  return (
    20.0 * Math.log10(dMeters) +
    20.0 * Math.log10(freqHz) +
    20.0 * Math.log10((4.0 * Math.PI) / SPEED_OF_LIGHT_M_S)
  );
}

/**
 * Evaluates geometric DTE line-of-sight at a single ephemeris time step.
 */
export function evaluateDteStep(
  step: EphemerisStep,
  horizonMaskDeg: Float32Array
): DteStepResult {
  const horizonElDeg = sampleHorizonAtAzimuth(horizonMaskDeg, step.earth.azimuth_deg);
  const earthElDeg = step.earth.elevation_deg;
  const visible = earthElDeg > horizonElDeg;

  return {
    visible,
    label: 'Geometric LOS (unobstructed terrain vector)',
    earthElDeg,
    horizonElDeg,
    marginDeg: earthElDeg - horizonElDeg,
    rangeKm: step.earth.range_km,
    lightTimeS: step.earth.light_time_seconds,
    fsplXBandDb: step.earth.fspl_x_band_db,
    dsnComplex: step.earth.candidate_dsn_complex,
  };
}

export interface WindowDteStats {
  dteUptimePct: number;
  longestBlackoutHours: number;
  hourlyVisible: Uint8Array;
}

/**
 * Evaluates DTE geometric availability and longest continuous blackout across the mission window.
 */
export function computeWindowDteStats(
  horizonMaskDeg: Float32Array,
  ephemerisSteps: EphemerisStep[],
  stepHours = 1.0
): WindowDteStats {
  const n = ephemerisSteps.length;
  const hourlyVisible = new Uint8Array(n);

  let visibleCount = 0;
  let currentBlackout = 0;
  let longestBlackout = 0;

  for (let i = 0; i < n; i++) {
    const step = ephemerisSteps[i];
    const horizonEl = sampleHorizonAtAzimuth(horizonMaskDeg, step.earth.azimuth_deg);
    const isVis = step.earth.elevation_deg > horizonEl;

    if (isVis) {
      hourlyVisible[i] = 1;
      visibleCount++;
      currentBlackout = 0;
    } else {
      hourlyVisible[i] = 0;
      currentBlackout += stepHours;
      if (currentBlackout > longestBlackout) {
        longestBlackout = currentBlackout;
      }
    }
  }

  return {
    dteUptimePct: n > 0 ? (visibleCount / n) * 100.0 : 0,
    longestBlackoutHours: longestBlackout,
    hourlyVisible,
  };
}
