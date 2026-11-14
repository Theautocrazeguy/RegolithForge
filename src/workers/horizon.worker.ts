/// <reference lib="webworker" />
import { computeWindowDteStats } from '../core/dte';
import { computeHorizonMask } from '../core/horizon';
import { computeWindowPowerStats } from '../core/power';
import { computeFootprintSlope, computeSlopeAtPixel } from '../core/slope';
import { EphemerisStep, SolarArrayModel } from '../core/types';

export interface HorizonWorkerRequest {
  requestId: number;
  elev: Float32Array;
  width: number;
  height: number;
  px: number;
  py: number;
  pixelSizeM: number;
  mastHeightM: number;
  siteLonDeg: number;
  arrayModel: SolarArrayModel;
  arrayAreaM2: number;
  arrayEfficiency: number;
  footprintM: number;
  ephemerisSteps: EphemerisStep[];
}

self.onmessage = (e: MessageEvent<HorizonWorkerRequest>) => {
  const {
    requestId,
    elev,
    width,
    height,
    px,
    py,
    pixelSizeM,
    mastHeightM,
    siteLonDeg,
    arrayModel,
    arrayAreaM2,
    arrayEfficiency,
    footprintM,
    ephemerisSteps,
  } = e.data;

  const t0 = performance.now();

  const horizon = computeHorizonMask(
    elev,
    width,
    height,
    px,
    py,
    pixelSizeM,
    mastHeightM,
    true,
    siteLonDeg
  );

  const localSlope = computeSlopeAtPixel(elev, width, height, px, py, pixelSizeM);
  const footprintSlopeDeg = computeFootprintSlope(
    elev,
    width,
    height,
    px,
    py,
    pixelSizeM,
    footprintM
  );

  const powerStats = computeWindowPowerStats(
    horizon.maskDeg,
    ephemerisSteps,
    arrayModel,
    arrayAreaM2,
    arrayEfficiency
  );

  const dteStats = computeWindowDteStats(horizon.maskDeg, ephemerisSteps);

  const computeMs = performance.now() - t0;

  self.postMessage({
    requestId,
    computeMs,
    horizonMaskDeg: horizon.maskDeg,
    localSlopeDeg: localSlope.slopeDeg,
    footprintSlopeDeg,
    powerStats,
    dteStats,
  });
};
