/**
 * Autonomous rover traverse solver using directional slope-constrained A*
 * and lunar regolith mechanical energy estimation.
 */

import { GridPoint, LUNAR_GRAVITY_M_S2, TraverseOptions, TraverseResult } from './types';

const RAD_TO_DEG = 180.0 / Math.PI;
const JOULES_PER_WH = 3600.0;

class MinHeap {
  private nodes: { idx: number; f: number }[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(idx: number, f: number): void {
    this.nodes.push({ idx, f });
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): number {
    const top = this.nodes[0].idx;
    const end = this.nodes.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = end;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(n: number): void {
    const item = this.nodes[n];
    while (n > 0) {
      const parentIdx = (n - 1) >> 1;
      const parent = this.nodes[parentIdx];
      if (item.f >= parent.f) break;
      this.nodes[n] = parent;
      n = parentIdx;
    }
    this.nodes[n] = item;
  }

  private sinkDown(n: number): void {
    const length = this.nodes.length;
    const item = this.nodes[n];
    while (true) {
      const leftIdx = (n << 1) + 1;
      const rightIdx = leftIdx + 1;
      let swap = -1;
      if (leftIdx < length && this.nodes[leftIdx].f < item.f) {
        swap = leftIdx;
      }
      if (
        rightIdx < length &&
        this.nodes[rightIdx].f < (swap === -1 ? item.f : this.nodes[leftIdx].f)
      ) {
        swap = rightIdx;
      }
      if (swap === -1) break;
      this.nodes[n] = this.nodes[swap];
      n = swap;
    }
    this.nodes[n] = item;
  }
}

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Finds an optimal rover traverse path from start to goal on the DEM grid.
 * Respects directional slope limits, calculates regolith rolling + gravitational energy,
 * and optionally penalizes shadowed/dark segments.
 */
export function findRoverPath(
  elev: Float32Array,
  width: number,
  height: number,
  pixelSizeM: number,
  start: GridPoint,
  goal: GridPoint,
  options: TraverseOptions
): TraverseResult {
  const sx = Math.max(0, Math.min(width - 1, Math.round(start.px)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(start.py)));
  const gx = Math.max(0, Math.min(width - 1, Math.round(goal.px)));
  const gy = Math.max(0, Math.min(height - 1, Math.round(goal.py)));

  const totalNodes = width * height;
  const startIdx = sy * width + sx;
  const goalIdx = gy * width + gx;

  if (startIdx === goalIdx) {
    return {
      found: true,
      path: [{ px: sx, py: sy }],
      totalDistanceM: 0,
      totalEnergyWh: 0,
      maxSlopeEncounteredDeg: 0,
      estimatedTimeHours: 0,
      sunlitFraction: options.illuminationGrid ? options.illuminationGrid[startIdx] : 1.0,
    };
  }

  const gScore = new Float32Array(totalNodes).fill(Infinity);
  const cameFrom = new Int32Array(totalNodes).fill(-1);
  const closed = new Uint8Array(totalNodes);
  const open = new MinHeap();

  gScore[startIdx] = 0;
  open.push(startIdx, Math.hypot(gx - sx, gy - sy) * pixelSizeM);

  const illumWeight = options.illuminationPenaltyWeight ?? 0.0;
  const illumGrid = options.illuminationGrid;

  let found = false;

  while (open.size > 0) {
    const current = open.pop();
    if (current === goalIdx) {
      found = true;
      break;
    }
    if (closed[current]) continue;
    closed[current] = 1;

    const cx = current % width;
    const cy = Math.floor(current / width);
    const cz = elev[current];

    for (let d = 0; d < 8; d++) {
      const [dx, dy, distFactor] = DIRS[d];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nIdx = ny * width + nx;
      if (closed[nIdx]) continue;

      const horizDist = distFactor * pixelSizeM;
      const dz = elev[nIdx] - cz;
      const slopeRad = Math.atan(Math.abs(dz) / horizDist);
      const slopeDeg = slopeRad * RAD_TO_DEG;

      if (slopeDeg > options.maxSlopeDeg) continue;

      // Directional slope penalty + optional illumination awareness
      const tanS = Math.abs(dz) / horizDist;
      let stepCost = horizDist * (1.0 + 4.0 * tanS * tanS);
      if (illumGrid && illumWeight > 0) {
        const darkness = 1.0 - illumGrid[nIdx];
        stepCost *= 1.0 + illumWeight * darkness;
      }

      const tentativeG = gScore[current] + stepCost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        const h = Math.hypot(gx - nx, gy - ny) * pixelSizeM;
        open.push(nIdx, tentativeG + h);
      }
    }
  }

  if (!found) {
    return {
      found: false,
      path: [],
      totalDistanceM: 0,
      totalEnergyWh: 0,
      maxSlopeEncounteredDeg: 0,
      estimatedTimeHours: 0,
      sunlitFraction: 0,
    };
  }

  // Reconstruct path
  const revPath: GridPoint[] = [];
  let curr = goalIdx;
  while (curr !== -1) {
    revPath.push({ px: curr % width, py: Math.floor(curr / width) });
    curr = cameFrom[curr];
  }
  const path = revPath.reverse();

  // Compute physical telemetry along the final path
  let totalDistanceM = 0;
  let totalEnergyJoules = 0;
  let maxSlopeEncounteredDeg = 0;
  let sunlitAccum = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const aIdx = a.py * width + a.px;
    const bIdx = b.py * width + b.px;

    const ds = Math.hypot(b.px - a.px, b.py - a.py) * pixelSizeM;
    const dz = elev[bIdx] - elev[aIdx];
    const slopeRad = Math.atan(Math.abs(dz) / ds);
    const slopeDeg = slopeRad * RAD_TO_DEG;

    totalDistanceM += ds;
    if (slopeDeg > maxSlopeEncounteredDeg) maxSlopeEncounteredDeg = slopeDeg;

    // Mechanical energy: rolling resistance + climbing work (no regenerative braking downhill)
    const rollingWork = options.rollingResistance * options.roverMassKg * LUNAR_GRAVITY_M_S2 * Math.cos(slopeRad) * ds;
    const climbWork = dz > 0 ? options.roverMassKg * LUNAR_GRAVITY_M_S2 * dz : 0;
    totalEnergyJoules += rollingWork + climbWork;

    if (illumGrid) {
      sunlitAccum += illumGrid[bIdx];
    }
  }

  // Nominal lunar rover speed ~0.15 m/s (~540 m/hr)
  const nominalSpeedMPerHr = 540.0;

  return {
    found: true,
    path,
    totalDistanceM: Math.round(totalDistanceM * 10) / 10,
    totalEnergyWh: Math.round((totalEnergyJoules / JOULES_PER_WH) * 100) / 100,
    maxSlopeEncounteredDeg: Math.round(maxSlopeEncounteredDeg * 10) / 10,
    estimatedTimeHours: Math.round((totalDistanceM / nominalSpeedMPerHr) * 100) / 100,
    sunlitFraction: illumGrid && path.length > 1 ? sunlitAccum / (path.length - 1) : 1.0,
  };
}
