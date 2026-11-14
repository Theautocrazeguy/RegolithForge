import { describe, expect, it } from 'vitest';
import {
  azElToVector,
  fullGridIJToLatLon,
  gridConvergenceDeg,
  latLonToFullGridIJ,
  trueAzToGridAz,
  vectorToAzEl,
} from '../azEl';
import { computeFreeSpacePathLossDb, evaluateDteStep } from '../dte';
import {
  computeHorizonMask,
  rayMarchSunVisibility,
  sampleHorizonAtAzimuth,
} from '../horizon';
import {
  computeArrayPowerWatts,
  computePartialIllumination,
  scaleSolarFlux,
} from '../power';
import { scoreLandingSite } from '../score';
import { computeFootprintSlope, computeSlopeAtPixel } from '../slope';
import { findRoverPath } from '../traverse';
import { EphemerisStep, R_MOON_M, SOLAR_ANGULAR_RADIUS_DEG } from '../types';

describe('Az/El and Polar Stereographic Coordinate Frames', () => {
  it('maps cardinal Az/El to -Z=North, +X=East, +Y=Up', () => {
    const north = azElToVector(0, 0);
    expect(north.x).toBeCloseTo(0, 6);
    expect(north.y).toBeCloseTo(0, 6);
    expect(north.z).toBeCloseTo(-1, 6);

    const east = azElToVector(90, 0);
    expect(east.x).toBeCloseTo(1, 6);
    expect(east.y).toBeCloseTo(0, 6);
    expect(east.z).toBeCloseTo(0, 6);

    const south = azElToVector(180, 0);
    expect(south.x).toBeCloseTo(0, 6);
    expect(south.y).toBeCloseTo(0, 6);
    expect(south.z).toBeCloseTo(1, 6);

    const west = azElToVector(270, 0);
    expect(west.x).toBeCloseTo(-1, 6);
    expect(west.y).toBeCloseTo(0, 6);
    expect(west.z).toBeCloseTo(0, 6);

    const zenith = azElToVector(45, 90);
    expect(zenith.x).toBeCloseTo(0, 6);
    expect(zenith.y).toBeCloseTo(1, 6);
    expect(zenith.z).toBeCloseTo(0, 6);
  });

  it('round-trips arbitrary Az/El through 3D vectors', () => {
    const cases = [
      { az: 80.34, el: 1.08 },
      { az: 136.35, el: 5.99 },
      { az: 312.5, el: -4.2 },
    ];
    for (const c of cases) {
      const v = azElToVector(c.az, c.el);
      const back = vectorToAzEl(v.x, v.y, v.z);
      expect(back.azDeg).toBeCloseTo(c.az, 5);
      expect(back.elDeg).toBeCloseTo(c.el, 5);
    }
  });

  it('round-trips South Polar Stereographic coordinates and handles grid convergence', () => {
    const { i, j } = latLonToFullGridIJ(-89.45, 222.5);
    const back = fullGridIJToLatLon(i, j);
    expect(back.latDeg).toBeCloseTo(-89.45, 5);
    expect(back.lonDeg).toBeCloseTo(222.5, 4);

    // At 90° E, meridian convergence is +90°, so true North (0°) points along grid 270°
    expect(gridConvergenceDeg(90, 0)).toBeCloseTo(90, 6);
    expect(trueAzToGridAz(0, 90, 0)).toBeCloseTo(270, 6);
  });
});

describe('Slope Calculation on Known Plane', () => {
  it('computes exact 15° slope on an inclined plane', () => {
    const w = 16;
    const h = 16;
    const pxSize = 20.0;
    const elev = new Float32Array(w * h);
    const targetSlopeRad = (15.0 * Math.PI) / 180.0;
    const grad = Math.tan(targetSlopeRad);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        elev[y * w + x] = x * pxSize * grad;
      }
    }

    const { slopeDeg, dzDx, dzDy } = computeSlopeAtPixel(elev, w, h, 8, 8, pxSize);
    expect(slopeDeg).toBeCloseTo(15.0, 4);
    expect(dzDx).toBeCloseTo(grad, 5);
    expect(dzDy).toBeCloseTo(0.0, 5);

    const footprintSlope = computeFootprintSlope(elev, w, h, 8, 8, pxSize, 60.0);
    expect(footprintSlope).toBeCloseTo(15.0, 4);
  });
});

describe('Horizon Raycaster with Lunar Curvature', () => {
  it('reduces distant rim elevation by d^2 / (2*R_MOON) (~115.1m at 20 km)', () => {
    const w = 256;
    const h = 256;
    const pixelSizeM = 100.0; // 25.6 km grid
    const elev = new Float32Array(w * h).fill(0);

    // Observer at (20, 128), 500m peak at 20 km East (x = 220, y = 128)
    const obsX = 20;
    const obsY = 128;
    const peakDistPx = 200; // 200 * 100m = 20,000 m
    elev[obsY * w + (obsX + peakDistPx)] = 500.0;

    const withCurv = computeHorizonMask(elev, w, h, obsX, obsY, pixelSizeM, 0, true);
    const noCurv = computeHorizonMask(elev, w, h, obsX, obsY, pixelSizeM, 0, false);

    // East is Azimuth = 90°
    const elWithCurv = withCurv.maskDeg[90];
    const elNoCurv = noCurv.maskDeg[90];

    const expectedDrop = (20000 * 20000) / (2 * R_MOON_M); // ~115.11 m
    const expectedAngleWithCurv = (Math.atan((500 - expectedDrop) / 20000) * 180) / Math.PI;
    const expectedAngleNoCurv = (Math.atan(500 / 20000) * 180) / Math.PI;

    expect(elNoCurv).toBeCloseTo(expectedAngleNoCurv, 3);
    expect(elWithCurv).toBeCloseTo(expectedAngleWithCurv, 3);
    expect(elWithCurv).toBeLessThan(elNoCurv);
    expect(expectedDrop).toBeCloseTo(115.11, 1);
  });

  it('lowers horizon obstruction angle when mast height increases', () => {
    const w = 64;
    const h = 64;
    const elev = new Float32Array(w * h).fill(0);
    elev[32 * w + 42] = 50.0; // 50m ridge 200m East (at 20m/px)

    const deck = computeHorizonMask(elev, w, h, 32, 32, 20, 0, true);
    const mast30 = computeHorizonMask(elev, w, h, 32, 32, 20, 30, true);

    expect(mast30.maskDeg[90]).toBeLessThan(deck.maskDeg[90]);
  });
});

describe('Solar Disc Partial Illumination & Array Power', () => {
  it('computes exact circular segment occultation across the 0.533° solar disc', () => {
    expect(computePartialIllumination(1.0, 2.0)).toBe(0);
    expect(computePartialIllumination(2.0, 2.0)).toBeCloseTo(0.5, 5);
    expect(computePartialIllumination(2.0 + SOLAR_ANGULAR_RADIUS_DEG, 2.0)).toBeCloseTo(1.0, 5);
    expect(computePartialIllumination(2.0 - SOLAR_ANGULAR_RADIUS_DEG, 2.0)).toBeCloseTo(0.0, 5);
  });

  it('scales flux by (1 AU / r)^2 and distinguishes vertical vs horizontal polar arrays', () => {
    expect(scaleSolarFlux(1.0)).toBeCloseTo(1361.0, 3);

    const vert = computeArrayPowerWatts(1.5, 0.0, 1.0, 'vertical', 5.0, 0.28);
    const horiz = computeArrayPowerWatts(1.5, 0.0, 1.0, 'horizontal', 5.0, 0.28);
    const dual = computeArrayPowerWatts(1.5, 0.0, 1.0, 'dual', 5.0, 0.28);

    // At 1.5° grazing elevation, vertical tracking captures ~99.96% of dual-axis,
    // while horizontal captures sin(1.5°) ≈ 2.6%
    expect(vert.powerW).toBeGreaterThan(horiz.powerW * 30);
    expect(dual.powerW).toBeGreaterThanOrEqual(vert.powerW);
    expect(dual.powerW).toBeCloseTo(1361.0 * 5.0 * 0.28, 2);
  });
});

describe('DTE Visibility & Link Telemetry', () => {
  it('evaluates geometric LOS, FSPL, and labels result explicitly', () => {
    const mask = new Float32Array(360).fill(2.0);
    const mockStep: EphemerisStep = {
      step_index: 0,
      utc_time: '2026-Oct-01 00:00',
      sun: { azimuth_deg: 80, elevation_deg: 1.1, heliocentric_distance_au: 1.0 },
      earth: {
        azimuth_deg: 136,
        elevation_deg: 5.5,
        range_km: 384400,
        light_time_seconds: 1.2822,
        fspl_x_band_db: 222.62,
        fspl_s_band_db: 210.98,
        candidate_dsn_complex: 'Goldstone (DSN-14/25)',
      },
    };

    const res = evaluateDteStep(mockStep, mask);
    expect(res.visible).toBe(true);
    expect(res.label).toBe('Geometric LOS (unobstructed terrain vector)');
    expect(res.marginDeg).toBeCloseTo(3.5, 3);
    expect(computeFreeSpacePathLossDb(384400, 8.4e9)).toBeCloseTo(222.62, 1);
  });
});

describe('Composite Scoring & A* Rover Traverse', () => {
  it('routes rover around a steep impassable ridge wall', () => {
    const w = 32;
    const h = 32;
    const elev = new Float32Array(w * h).fill(0);

    // Place a steep vertical ridge wall (400m high -> >85° slope) blocking x=16 from y=5..26
    for (let y = 5; y <= 26; y++) {
      elev[y * w + 16] = 400.0;
    }

    const res = findRoverPath(
      elev,
      w,
      h,
      20.0,
      { px: 8, py: 16 },
      { px: 24, py: 16 },
      { maxSlopeDeg: 15.0, roverMassKg: 200, rollingResistance: 0.1 }
    );

    expect(res.found).toBe(true);
    expect(res.maxSlopeEncounteredDeg).toBeLessThanOrEqual(15.0);
    // Must detour around y=4 or y=27, so distance > straight line (16 * 20 = 320m)
    expect(res.totalDistanceM).toBeGreaterThan(320.0);
    expect(res.totalEnergyWh).toBeGreaterThan(0);
  });

  it('disqualifies sites exceeding critical slope threshold', () => {
    const score = scoreLandingSite({
      slopeDeg: 18.5,
      illuminationPct: 90,
      dteUptimePct: 80,
      distanceToPsrM: 500,
      criticalSlopeDeg: 15.0,
    });
    expect(score.feasible).toBe(false);
    expect(score.slopeScore).toBe(0);
    expect(score.totalScore).toBeLessThanOrEqual(25.0);
  });
});

describe('3D-vs-HUD Consistency Test Harness (Rule 2.3-10)', () => {
  it('agrees across >= 25 random (site, time) pairs between ray-marched visibility and horizon mask', () => {
    const w = 128;
    const h = 128;
    const elev = new Float32Array(w * h);

    // Build synthetic crater + ridge terrain
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - 64;
        const dy = y - 64;
        const r = Math.hypot(dx, dy);
        elev[y * w + x] =
          200 * Math.sin(x * 0.08) * Math.cos(y * 0.07) +
          (r < 25 ? -300 * (1 - r / 25) : 0) +
          (Math.abs(r - 28) < 4 ? 180 : 0);
      }
    }

    // Deterministic PRNG for reproducible 30-sample verification
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const sampleCount = 30;
    let matches = 0;

    for (let k = 0; k < sampleCount; k++) {
      const px = Math.floor(16 + rand() * (w - 32));
      const py = Math.floor(16 + rand() * (h - 32));
      const mastHeightM = rand() > 0.5 ? 2.0 : 10.0;
      // Integer degree azimuths eliminate 1-degree mask quantization edge noise
      const sunAzDeg = Math.floor(rand() * 360);
      const sunElDeg = -1.0 + rand() * 5.0;

      const horizon = computeHorizonMask(elev, w, h, px, py, 20.0, mastHeightM, true, 0.0);
      const hudVisible = sunElDeg > sampleHorizonAtAzimuth(horizon.maskDeg, sunAzDeg);
      const rayVisible = rayMarchSunVisibility(
        elev,
        w,
        h,
        px,
        py,
        20.0,
        mastHeightM,
        sunAzDeg,
        sunElDeg,
        true,
        0.0
      );

      if (hudVisible === rayVisible) {
        matches++;
      }
    }

    expect(matches).toBe(sampleCount);
  });
});
