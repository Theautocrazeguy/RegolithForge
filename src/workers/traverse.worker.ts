/// <reference lib="webworker" />
import { findRoverPath } from '../core/traverse';
import { GridPoint, TraverseOptions } from '../core/types';

export interface TraverseWorkerRequest {
  requestId: number;
  elev: Float32Array;
  width: number;
  height: number;
  pixelSizeM: number;
  start: GridPoint;
  goal: GridPoint;
  options: TraverseOptions;
}

self.onmessage = (e: MessageEvent<TraverseWorkerRequest>) => {
  const { requestId, elev, width, height, pixelSizeM, start, goal, options } = e.data;
  const t0 = performance.now();
  const result = findRoverPath(elev, width, height, pixelSizeM, start, goal, options);
  const computeMs = performance.now() - t0;

  self.postMessage({
    requestId,
    computeMs,
    result,
  });
};
