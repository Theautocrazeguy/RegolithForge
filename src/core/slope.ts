/**
 * Terrain slope calculation via 2D central differences and footprint-scale plane fitting.
 */

const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * Bilinearly samples elevation from a Float32Array DEM grid.
 */
export function sampleElevation(
  elev: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number
): number {
  const x = Math.max(0, Math.min(width - 1, px));
  const y = Math.max(0, Math.min(height - 1, py));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;

  const z00 = elev[y0 * width + x0];
  const z10 = elev[y0 * width + x1];
  const z01 = elev[y1 * width + x0];
  const z11 = elev[y1 * width + x1];

  return (
    z00 * (1 - fx) * (1 - fy) +
    z10 * fx * (1 - fy) +
    z01 * (1 - fx) * fy +
    z11 * fx * fy
  );
}

/**
 * Computes local slope angle (degrees) and gradient vector (dz/dx, dz/dy)
 * using 2D central differences at grid pixel (px, py).
 */
export function computeSlopeAtPixel(
  elev: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number,
  pixelSizeM = 20.0
): { slopeDeg: number; dzDx: number; dzDy: number } {
  const ix = Math.max(0, Math.min(width - 1, Math.round(px)));
  const iy = Math.max(0, Math.min(height - 1, Math.round(py)));

  const xm = Math.max(0, ix - 1);
  const xp = Math.min(width - 1, ix + 1);
  const ym = Math.max(0, iy - 1);
  const yp = Math.min(height - 1, iy + 1);

  const dxDist = (xp - xm) * pixelSizeM;
  const dyDist = (yp - ym) * pixelSizeM;

  const dzDx = dxDist > 0 ? (elev[iy * width + xp] - elev[iy * width + xm]) / dxDist : 0;
  const dzDy = dyDist > 0 ? (elev[yp * width + ix] - elev[ym * width + ix]) / dyDist : 0;

  const gradMag = Math.hypot(dzDx, dzDy);
  const slopeDeg = Math.atan(gradMag) * RAD_TO_DEG;

  return { slopeDeg, dzDx, dzDy };
}

/**
 * Computes lander-footprint-scale slope (degrees) by fitting a least-squares plane
 * z = a*x + b*y + c over a square footprint centered at (px, py).
 */
export function computeFootprintSlope(
  elev: Float32Array,
  width: number,
  height: number,
  px: number,
  py: number,
  pixelSizeM = 20.0,
  footprintM = 40.0
): number {
  const halfRadiusPx = Math.max(1, Math.round(footprintM / (2 * pixelSizeM)));
  const cx = Math.round(px);
  const cy = Math.round(py);

  // Because the sampling window is symmetric around (cx, cy), sum(x)=0, sum(y)=0, sum(xy)=0
  // unless clipped at grid boundary; use full normal equations for boundary safety.
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  let sumXZ = 0;
  let sumYZ = 0;
  let n = 0;

  for (let dy = -halfRadiusPx; dy <= halfRadiusPx; dy++) {
    const sy = cy + dy;
    if (sy < 0 || sy >= height) continue;
    for (let dx = -halfRadiusPx; dx <= halfRadiusPx; dx++) {
      const sx = cx + dx;
      if (sx < 0 || sx >= width) continue;
      const x = dx * pixelSizeM;
      const y = dy * pixelSizeM;
      const z = elev[sy * width + sx];
      sumX += x;
      sumY += y;
      sumZ += z;
      sumXX += x * x;
      sumYY += y * y;
      sumXY += x * y;
      sumXZ += x * z;
      sumYZ += y * z;
      n++;
    }
  }

  if (n < 3) return 0;

  // Center coordinates to eliminate intercept term c
  const mx = sumX / n;
  const my = sumY / n;
  const mz = sumZ / n;

  const sxx = sumXX - n * mx * mx;
  const syy = sumYY - n * my * my;
  const sxy = sumXY - n * mx * my;
  const sxz = sumXZ - n * mx * mz;
  const syz = sumYZ - n * my * mz;

  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-9) return 0;

  const a = (syy * sxz - sxy * syz) / det;
  const b = (sxx * syz - sxy * sxz) / det;

  return Math.atan(Math.hypot(a, b)) * RAD_TO_DEG;
}
