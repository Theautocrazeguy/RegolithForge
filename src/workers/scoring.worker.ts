/// <reference lib="webworker" />
import { localPixelToLatLon } from '../core/azEl';
import { computeWindowDteStats } from '../core/dte';
import { computeHorizonMask } from '../core/horizon';
import { computeWindowPowerStats } from '../core/power';
import { scoreLandingSite } from '../core/score';
import { computeSlopeAtPixel, sampleElevation } from '../core/slope';
import { EphemerisStep, SiteScoreBreakdown, SiteWeights, SolarArrayModel } from '../core/types';

export interface ScoringWorkerRequest {
  requestId: number;
  elev: Float32Array;
  width: number;
  height: number;
  pixelSizeM: number;
  psrMask: Uint8Array;
  illumGrid: Float32Array;
  ephemerisSteps: EphemerisStep[];
  weights: SiteWeights;
  criticalSlopeDeg: number;
  mastHeightM: number;
  arrayModel: SolarArrayModel;
  topN: number;
  stridePx?: number;
}

export interface RankedSiteCandidate {
  px: number;
  py: number;
  latDeg: number;
  lonDeg: number;
  elevM: number;
  slopeDeg: number;
  illuminationPct: number;
  dteUptimePct: number;
  distanceToPsrM: number;
  breakdown: SiteScoreBreakdown;
}

function estimateDistanceToPsr(
  psrMask: Uint8Array,
  width: number,
  height: number,
  px: number,
  py: number,
  pixelSizeM: number
): number {
  const maxRadiusPx = 60; // 1.2 km search window
  let minDistSq = Infinity;
  for (let dy = -maxRadiusPx; dy <= maxRadiusPx; dy += 4) {
    const sy = py + dy;
    if (sy < 0 || sy >= height) continue;
    for (let dx = -maxRadiusPx; dx <= maxRadiusPx; dx += 4) {
      const sx = px + dx;
      if (sx < 0 || sx >= width) continue;
      if (psrMask[sy * width + sx] > 127) {
        const dSq = dx * dx + dy * dy;
        if (dSq < minDistSq) minDistSq = dSq;
      }
    }
  }
  return Number.isFinite(minDistSq) ? Math.sqrt(minDistSq) * pixelSizeM : 5000.0;
}

self.onmessage = (e: MessageEvent<ScoringWorkerRequest>) => {
  const {
    requestId,
    elev,
    width,
    height,
    pixelSizeM,
    psrMask,
    illumGrid,
    ephemerisSteps,
    weights,
    criticalSlopeDeg,
    mastHeightM,
    arrayModel,
    topN,
    stridePx = 32,
  } = e.data;

  const t0 = performance.now();
  const candidates: RankedSiteCandidate[] = [];

  // Pass 1: coarse grid screen using precomputed illumination + slope
  const prefiltered: { px: number; py: number; slopeDeg: number; approxIllum: number }[] = [];
  for (let py = 32; py < height - 32; py += stridePx) {
    for (let px = 32; px < width - 32; px += stridePx) {
      const { slopeDeg } = computeSlopeAtPixel(elev, width, height, px, py, pixelSizeM);
      if (slopeDeg > criticalSlopeDeg) continue;
      const approxIllum = illumGrid[py * width + px] * 100.0;
      prefiltered.push({ px, py, slopeDeg, approxIllum });
    }
  }

  // Sort by approx illumination and take top 40 for exact curvature-corrected horizon evaluation
  prefiltered.sort((a, b) => b.approxIllum - a.approxIllum);
  const shortlist = prefiltered.slice(0, Math.min(40, prefiltered.length));

  for (const item of shortlist) {
    const { latDeg, lonDeg } = localPixelToLatLon(item.px, item.py);
    const horizon = computeHorizonMask(
      elev,
      width,
      height,
      item.px,
      item.py,
      pixelSizeM,
      mastHeightM,
      true,
      lonDeg
    );

    const powerStats = computeWindowPowerStats(horizon.maskDeg, ephemerisSteps, arrayModel);
    const dteStats = computeWindowDteStats(horizon.maskDeg, ephemerisSteps);
    const distanceToPsrM = estimateDistanceToPsr(
      psrMask,
      width,
      height,
      item.px,
      item.py,
      pixelSizeM
    );

    const breakdown = scoreLandingSite(
      {
        slopeDeg: item.slopeDeg,
        illuminationPct: powerStats.illuminationFractionPct,
        dteUptimePct: dteStats.dteUptimePct,
        distanceToPsrM,
        criticalSlopeDeg,
      },
      weights
    );

    candidates.push({
      px: item.px,
      py: item.py,
      latDeg,
      lonDeg,
      elevM: sampleElevation(elev, width, height, item.px, item.py),
      slopeDeg: item.slopeDeg,
      illuminationPct: powerStats.illuminationFractionPct,
      dteUptimePct: dteStats.dteUptimePct,
      distanceToPsrM,
      breakdown,
    });
  }

  candidates.sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);
  const computeMs = performance.now() - t0;

  self.postMessage({
    requestId,
    computeMs,
    candidates: candidates.slice(0, topN),
  });
};
