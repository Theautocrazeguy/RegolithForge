/**
 * Transparent multi-criteria landing site scoring engine.
 * Every score component (0..100) is exposed individually to avoid black-box rankings.
 */

import { SiteScoreBreakdown, SiteWeights } from './types';

export interface SiteMetricsInput {
  slopeDeg: number;
  illuminationPct: number;
  dteUptimePct: number;
  distanceToPsrM: number;
  criticalSlopeDeg: number;
}

export const DEFAULT_SITE_WEIGHTS: SiteWeights = {
  slope: 0.30,
  illumination: 0.35,
  dte: 0.25,
  iceProximity: 0.10,
};

/**
 * Computes a transparent composite landing site score (0..100).
 * Sites exceeding criticalSlopeDeg are flagged as infeasible for landing.
 */
export function scoreLandingSite(
  metrics: SiteMetricsInput,
  weights: SiteWeights = DEFAULT_SITE_WEIGHTS
): SiteScoreBreakdown {
  const feasible = metrics.slopeDeg <= metrics.criticalSlopeDeg;

  // Slope safety: 0° = 100 pts, criticalSlopeDeg = 20 pts, > criticalSlopeDeg = 0 pts
  let slopeScore = 0;
  if (feasible) {
    slopeScore = Math.max(0, 100.0 * (1.0 - 0.8 * (metrics.slopeDeg / Math.max(1, metrics.criticalSlopeDeg))));
  }

  // Illumination: direct percentage 0..100
  const illuminationScore = Math.max(0, Math.min(100, metrics.illuminationPct));

  // DTE: direct percentage 0..100
  const dteScore = Math.max(0, Math.min(100, metrics.dteUptimePct));

  // Ice proximity: exponential decay with 2 km characteristic scale; 0m = 100 pts, 2km = 37 pts
  const iceScore = 100.0 * Math.exp(-Math.max(0, metrics.distanceToPsrM) / 2000.0);

  const wSum = weights.slope + weights.illumination + weights.dte + weights.iceProximity;
  const norm = wSum > 0 ? 1.0 / wSum : 0.25;

  let totalScore =
    (slopeScore * weights.slope +
      illuminationScore * weights.illumination +
      dteScore * weights.dte +
      iceScore * weights.iceProximity) *
    norm;

  if (!feasible) {
    totalScore = Math.min(totalScore, 25.0);
  }

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    slopeScore: Math.round(slopeScore * 10) / 10,
    illuminationScore: Math.round(illuminationScore * 10) / 10,
    dteScore: Math.round(dteScore * 10) / 10,
    iceScore: Math.round(iceScore * 10) / 10,
    feasible,
    disqualificationReason: feasible
      ? undefined
      : `Slope ${metrics.slopeDeg.toFixed(1)}° exceeds critical limit (${metrics.criticalSlopeDeg}°)`,
  };
}
