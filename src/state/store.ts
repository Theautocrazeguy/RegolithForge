import { create } from 'zustand';
import {
  latLonToLocalPixel,
  localPixelToLatLon,
  localPixelToWorldMeters,
} from '../core/azEl';
import { WindowDteStats } from '../core/dte';
import { WindowPowerStats } from '../core/power';
import { DEFAULT_SITE_WEIGHTS, scoreLandingSite } from '../core/score';
import { computeFootprintSlope, computeSlopeAtPixel, sampleElevation } from '../core/slope';
import {
  AOI_DIM,
  EphemerisStep,
  GridPoint,
  LOLA_MAP_SCALE_M,
  ProvenanceTag,
  SiteScoreBreakdown,
  SiteWeights,
  SolarArrayModel,
  TraverseResult,
} from '../core/types';
import type { RankedSiteCandidate } from '../workers/scoring.worker';

export interface HeightmapMeta {
  provenance: ProvenanceTag;
  source: string;
  citation: string;
  dimensions: [number, number];
  pixel_size_m: number;
  width_km: number;
  height_km: number;
  min_elevation_m: number;
  max_elevation_m: number;
  mean_elevation_m: number;
  center_lat: number;
  center_lon: number;
}

export interface EphemerisSite {
  name: string;
  lat: number;
  lon: number;
  elev_km: number;
  ephemeris: EphemerisStep[];
}

export interface EphemerisDataset {
  provenance: ProvenanceTag;
  source: string;
  observer_body: number;
  sites: Record<string, EphemerisSite>;
}

export interface ActiveSiteState {
  name?: string;
  px: number;
  py: number;
  worldX: number;
  worldZ: number;
  latDeg: number;
  lonDeg: number;
  elevM: number;
  localSlopeDeg: number;
  footprintSlopeDeg: number;
}

export interface PinnedSiteSnapshot {
  id: string;
  label: string;
  site: ActiveSiteState;
  powerStats: WindowPowerStats;
  dteStats: WindowDteStats;
  score: SiteScoreBreakdown;
}

export interface UncertaintyStats {
  radiusM: number;
  worstSlopeDeg: number;
  meanSlopeDeg: number;
  minIllumPct: number;
  maxIllumPct: number;
}

export type PlannerTab = 'telemetry' | 'finder' | 'compare' | 'traverse' | 'tools';

interface RegolithStore {
  loaded: boolean;
  loadingStatus: string;
  error: string | null;

  // Datasets
  elev: Float32Array | null;
  demMeta: HeightmapMeta | null;
  ephemeris: EphemerisDataset | null;
  activeEphemerisKey: string;
  slopeGrid: Uint8Array | null;
  illumGrid: Float32Array | null;
  psrGrid: Uint8Array | null;
  thermalMeta: Record<string, unknown> | null;
  iceMeta: Record<string, unknown> | null;
  analogsData: { sites: Array<Record<string, unknown>> } | null;

  // Mission parameters & controls
  mode: 'planner' | 'explorer';
  cameraView: 'site' | 'globe';
  activeTab: PlannerTab;
  stepIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  mastHeightM: number;
  criticalSlopeDeg: number;
  footprintM: number;
  arrayModel: SolarArrayModel;
  colorBlindSafe: boolean;

  // Overlays & Modals
  showSlopeHazard: boolean;
  showPelOverlay: boolean;
  showPsrOverlay: boolean;
  showThermalOverlay: boolean;
  showLabels: boolean;
  showProvenanceModal: boolean;
  showAnalogsModal: boolean;

  // Selected site & worker telemetry
  activeSite: ActiveSiteState | null;
  horizonMaskDeg: Float32Array | null;
  powerStats: WindowPowerStats | null;
  dteStats: WindowDteStats | null;
  activeScore: SiteScoreBreakdown | null;
  workerComputeMs: number;
  computingHorizon: boolean;

  // Site Finder & Compare (M5)
  siteWeights: SiteWeights;
  finderResults: RankedSiteCandidate[];
  findingSites: boolean;
  pinnedSites: PinnedSiteSnapshot[];

  // Traverse Solver (M7)
  pickingTraverseGoal: boolean;
  traverseGoal: GridPoint | null;
  traverseResult: TraverseResult | null;
  computingTraverse: boolean;
  maxRoverSlopeDeg: number;
  illuminationAwareTraverse: boolean;

  // Wow Layer (M8)
  uncertaintyRadiusM: number;
  uncertaintyStats: UncertaintyStats | null;
  pitchTourActive: boolean;
  pitchTourStep: number;

  // Actions
  loadAssets: () => Promise<void>;
  setStepIndex: (idx: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setMastHeightM: (h: number) => void;
  setCriticalSlopeDeg: (deg: number) => void;
  setFootprintM: (m: number) => void;
  setArrayModel: (model: SolarArrayModel) => void;
  setMode: (mode: 'planner' | 'explorer') => void;
  setCameraView: (view: 'site' | 'globe') => void;
  setActiveTab: (tab: PlannerTab) => void;
  toggleColorBlindSafe: () => void;
  setOverlay: (
    key: 'showSlopeHazard' | 'showPelOverlay' | 'showPsrOverlay' | 'showThermalOverlay' | 'showLabels',
    val: boolean
  ) => void;
  setModal: (key: 'showProvenanceModal' | 'showAnalogsModal', val: boolean) => void;
  selectSiteByPixel: (px: number, py: number, customName?: string) => void;
  selectBenchmarkSite: (siteId: string) => void;
  recomputeSiteHorizon: () => void;

  // M5 Actions
  setSiteWeights: (w: SiteWeights) => void;
  runSiteFinder: () => void;
  pinCurrentSite: () => void;
  removePinnedSite: (id: string) => void;

  // M7 Actions
  setPickingTraverseGoal: (picking: boolean) => void;
  setTraverseGoal: (pt: GridPoint | null) => void;
  setMaxRoverSlopeDeg: (deg: number) => void;
  setIlluminationAwareTraverse: (val: boolean) => void;
  runTraverseToGoal: (goal: GridPoint) => void;

  // M8 Actions
  setUncertaintyRadiusM: (r: number) => void;
  setPitchTour: (active: boolean, step?: number) => void;
}

let horizonWorker: Worker | null = null;
let scoringWorker: Worker | null = null;
let traverseWorker: Worker | null = null;
let latestHorizonReqId = 0;
let latestScoringReqId = 0;
let latestTraverseReqId = 0;

function getHorizonWorker(): Worker {
  if (!horizonWorker) {
    horizonWorker = new Worker(new URL('../workers/horizon.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return horizonWorker;
}

function getScoringWorker(): Worker {
  if (!scoringWorker) {
    scoringWorker = new Worker(new URL('../workers/scoring.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return scoringWorker;
}

function getTraverseWorker(): Worker {
  if (!traverseWorker) {
    traverseWorker = new Worker(new URL('../workers/traverse.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return traverseWorker;
}

async function loadGrayscalePngAsUint8(url: string): Promise<Uint8Array> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const rgba = ctx.getImageData(0, 0, img.width, img.height).data;
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) {
    out[i] = rgba[i * 4];
  }
  return out;
}

function computeUncertaintyStats(
  elev: Float32Array,
  illumGrid: Float32Array,
  px: number,
  py: number,
  radiusM: number
): UncertaintyStats | null {
  if (radiusM <= 0) return null;
  const rPx = Math.max(1, Math.round(radiusM / LOLA_MAP_SCALE_M));
  const cx = Math.round(px);
  const cy = Math.round(py);

  let worstSlopeDeg = 0;
  let sumSlope = 0;
  let minIllum = 100;
  let maxIllum = 0;
  let count = 0;

  const stride = Math.max(1, Math.floor(rPx / 8));
  for (let dy = -rPx; dy <= rPx; dy += stride) {
    const sy = cy + dy;
    if (sy < 1 || sy >= AOI_DIM - 1) continue;
    for (let dx = -rPx; dx <= rPx; dx += stride) {
      if (dx * dx + dy * dy > rPx * rPx) continue;
      const sx = cx + dx;
      if (sx < 1 || sx >= AOI_DIM - 1) continue;

      const { slopeDeg } = computeSlopeAtPixel(elev, AOI_DIM, AOI_DIM, sx, sy, LOLA_MAP_SCALE_M);
      if (slopeDeg > worstSlopeDeg) worstSlopeDeg = slopeDeg;
      sumSlope += slopeDeg;

      const illPct = illumGrid[sy * AOI_DIM + sx] * 100.0;
      if (illPct < minIllum) minIllum = illPct;
      if (illPct > maxIllum) maxIllum = illPct;
      count++;
    }
  }

  return {
    radiusM,
    worstSlopeDeg: Math.round(worstSlopeDeg * 10) / 10,
    meanSlopeDeg: count > 0 ? Math.round((sumSlope / count) * 10) / 10 : 0,
    minIllumPct: Math.round(minIllum * 10) / 10,
    maxIllumPct: Math.round(maxIllum * 10) / 10,
  };
}

function syncUrlState(state: Partial<RegolithStore>) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (state.activeSite) {
    url.searchParams.set('px', Math.round(state.activeSite.px).toString());
    url.searchParams.set('py', Math.round(state.activeSite.py).toString());
  }
  if (state.stepIndex !== undefined) {
    url.searchParams.set('step', state.stepIndex.toString());
  }
  if (state.mode) {
    url.searchParams.set('mode', state.mode);
  }
  if (state.mastHeightM !== undefined) {
    url.searchParams.set('mast', state.mastHeightM.toString());
  }
  window.history.replaceState({}, '', url.toString());
}

export const useRegolithStore = create<RegolithStore>((set, get) => ({
  loaded: false,
  loadingStatus: 'Initializing telemetry systems...',
  error: null,

  elev: null,
  demMeta: null,
  ephemeris: null,
  activeEphemerisKey: 'connecting_ridge_primary',
  slopeGrid: null,
  illumGrid: null,
  psrGrid: null,
  thermalMeta: null,
  iceMeta: null,
  analogsData: null,

  mode: 'planner',
  cameraView: 'site',
  activeTab: 'telemetry',
  stepIndex: 0,
  isPlaying: false,
  playbackSpeed: 6,
  mastHeightM: 2.0,
  criticalSlopeDeg: 15.0,
  footprintM: 40.0,
  arrayModel: 'vertical',
  colorBlindSafe: false,

  showSlopeHazard: false,
  showPelOverlay: false,
  showPsrOverlay: false,
  showThermalOverlay: false,
  showLabels: true,
  showProvenanceModal: false,
  showAnalogsModal: false,

  activeSite: null,
  horizonMaskDeg: null,
  powerStats: null,
  dteStats: null,
  activeScore: null,
  workerComputeMs: 0,
  computingHorizon: false,

  siteWeights: DEFAULT_SITE_WEIGHTS,
  finderResults: [],
  findingSites: false,
  pinnedSites: [],

  pickingTraverseGoal: false,
  traverseGoal: null,
  traverseResult: null,
  computingTraverse: false,
  maxRoverSlopeDeg: 15.0,
  illuminationAwareTraverse: true,

  uncertaintyRadiusM: 0,
  uncertaintyStats: null,
  pitchTourActive: false,
  pitchTourStep: 0,

  loadAssets: async () => {
    if (get().loaded) return;
    try {
      set({ loadingStatus: 'Loading NASA LOLA 20m DEM & JPL Horizons ephemeris...' });

      const [metaRes, binRes, ephemRes, slopeU8, illumU8, psrU8, thermalRes, iceRes, analogsRes] =
        await Promise.all([
          fetch('/data/heightmap_meta.json').then((r) => r.json()),
          fetch('/data/heightmap_float32.bin').then((r) => r.arrayBuffer()),
          fetch('/data/ephemeris.json').then((r) => r.json()),
          loadGrayscalePngAsUint8('/data/slope.png'),
          loadGrayscalePngAsUint8('/data/illumination_fraction.png'),
          loadGrayscalePngAsUint8('/data/psr_mask.png'),
          fetch('/data/thermal.json').then((r) => r.json()).catch(() => null),
          fetch('/data/ice_proxy.json').then((r) => r.json()).catch(() => null),
          fetch('/data/analogs.json').then((r) => r.json()).catch(() => null),
        ]);

      const elev = new Float32Array(binRes);
      const illumGrid = new Float32Array(illumU8.length);
      for (let i = 0; i < illumU8.length; i++) {
        illumGrid[i] = illumU8[i] / 255.0;
      }

      // Restore URL params if present
      const params = new URLSearchParams(window.location.search);
      const urlStep = Number(params.get('step'));
      const urlMode = params.get('mode');
      const urlMast = Number(params.get('mast'));
      const urlPx = params.get('px');
      const urlPy = params.get('py');

      set({
        elev,
        demMeta: metaRes,
        ephemeris: ephemRes,
        slopeGrid: slopeU8,
        illumGrid,
        psrGrid: psrU8,
        thermalMeta: thermalRes,
        iceMeta: iceRes,
        analogsData: analogsRes,
        loaded: true,
        loadingStatus: 'Ready',
        stepIndex: Number.isFinite(urlStep) && urlStep >= 0 && urlStep < 720 ? urlStep : 0,
        mode: urlMode === 'explorer' ? 'explorer' : 'planner',
        mastHeightM: Number.isFinite(urlMast) && urlMast >= 0 && urlMast <= 30 ? urlMast : 2.0,
      });

      if (urlPx !== null && urlPy !== null && Number.isFinite(Number(urlPx)) && Number.isFinite(Number(urlPy))) {
        get().selectSiteByPixel(Number(urlPx), Number(urlPy), 'Shared Site');
      } else {
        get().selectBenchmarkSite('connecting_ridge_primary');
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load lunar assets',
        loadingStatus: 'Error',
      });
    }
  },

  setStepIndex: (idx) => {
    const ephem = get().ephemeris;
    const maxSteps = ephem
      ? ephem.sites[get().activeEphemerisKey]?.ephemeris.length ?? 720
      : 720;
    const clamped = ((idx % maxSteps) + maxSteps) % maxSteps;
    set({ stepIndex: clamped });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

  setMastHeightM: (mastHeightM) => {
    set({ mastHeightM });
    syncUrlState({ mastHeightM });
    get().recomputeSiteHorizon();
  },

  setCriticalSlopeDeg: (criticalSlopeDeg) => {
    set({ criticalSlopeDeg });
    get().recomputeSiteHorizon();
  },

  setFootprintM: (footprintM) => {
    set({ footprintM });
    const { activeSite, elev, demMeta } = get();
    if (activeSite && elev && demMeta) {
      const [h, w] = demMeta.dimensions;
      const footprintSlopeDeg = computeFootprintSlope(
        elev,
        w,
        h,
        activeSite.px,
        activeSite.py,
        demMeta.pixel_size_m,
        footprintM
      );
      set({ activeSite: { ...activeSite, footprintSlopeDeg } });
    }
  },

  setArrayModel: (arrayModel) => {
    set({ arrayModel });
    get().recomputeSiteHorizon();
  },

  setMode: (mode) => {
    set({ mode, ...(mode === 'explorer' ? { cameraView: 'site' } : {}) });
    syncUrlState({ mode });
  },

  setCameraView: (cameraView) => set({ cameraView }),

  setActiveTab: (activeTab) => set({ activeTab }),
  toggleColorBlindSafe: () => set((s) => ({ colorBlindSafe: !s.colorBlindSafe })),

  setOverlay: (key, val) => set({ [key]: val } as Partial<RegolithStore>),
  setModal: (key, val) => set({ [key]: val } as Partial<RegolithStore>),

  selectSiteByPixel: (px, py, customName) => {
    const { elev, demMeta, footprintM, illumGrid, uncertaintyRadiusM } = get();
    if (!elev || !demMeta) return;
    const [h, w] = demMeta.dimensions;
    const cpx = Math.max(2, Math.min(w - 3, px));
    const cpy = Math.max(2, Math.min(h - 3, py));

    const { latDeg, lonDeg } = localPixelToLatLon(cpx, cpy);
    const { worldX, worldZ } = localPixelToWorldMeters(cpx, cpy);
    const elevM = sampleElevation(elev, w, h, cpx, cpy);
    const { slopeDeg } = computeSlopeAtPixel(elev, w, h, cpx, cpy, demMeta.pixel_size_m);
    const footprintSlopeDeg = computeFootprintSlope(
      elev,
      w,
      h,
      cpx,
      cpy,
      demMeta.pixel_size_m,
      footprintM
    );

    const activeSite: ActiveSiteState = {
      name: customName,
      px: cpx,
      py: cpy,
      worldX,
      worldZ,
      latDeg,
      lonDeg,
      elevM,
      localSlopeDeg: slopeDeg,
      footprintSlopeDeg,
    };

    const uncertaintyStats =
      uncertaintyRadiusM > 0 && illumGrid
        ? computeUncertaintyStats(elev, illumGrid, cpx, cpy, uncertaintyRadiusM)
        : null;

    set({ activeSite, uncertaintyStats });
    syncUrlState({ activeSite });
    get().recomputeSiteHorizon();
  },

  selectBenchmarkSite: (siteId) => {
    const ephem = get().ephemeris;
    if (!ephem || !ephem.sites[siteId]) return;
    const site = ephem.sites[siteId];
    const { px, py } = latLonToLocalPixel(site.lat, site.lon);
    const clampedPx = Math.max(8, Math.min(AOI_DIM - 9, px));
    const clampedPy = Math.max(8, Math.min(AOI_DIM - 9, py));
    set({ activeEphemerisKey: siteId });
    get().selectSiteByPixel(clampedPx, clampedPy, site.name);
  },

  recomputeSiteHorizon: () => {
    const {
      elev,
      demMeta,
      activeSite,
      mastHeightM,
      arrayModel,
      footprintM,
      ephemeris,
      activeEphemerisKey,
      criticalSlopeDeg,
      siteWeights,
      psrGrid,
    } = get();

    if (!elev || !demMeta || !activeSite || !ephemeris) return;
    const steps = ephemeris.sites[activeEphemerisKey]?.ephemeris;
    if (!steps) return;

    const worker = getHorizonWorker();
    const requestId = ++latestHorizonReqId;
    set({ computingHorizon: true });

    worker.onmessage = (e) => {
      if (e.data.requestId !== latestHorizonReqId) return;

      // Estimate distance to nearest PSR pixel
      let distToPsr = 5000;
      if (psrGrid) {
        const cx = Math.round(activeSite.px);
        const cy = Math.round(activeSite.py);
        let minSq = Infinity;
        for (let dy = -60; dy <= 60; dy += 4) {
          const sy = cy + dy;
          if (sy < 0 || sy >= AOI_DIM) continue;
          for (let dx = -60; dx <= 60; dx += 4) {
            const sx = cx + dx;
            if (sx < 0 || sx >= AOI_DIM) continue;
            if (psrGrid[sy * AOI_DIM + sx] > 127) {
              const dSq = dx * dx + dy * dy;
              if (dSq < minSq) minSq = dSq;
            }
          }
        }
        if (Number.isFinite(minSq)) distToPsr = Math.sqrt(minSq) * LOLA_MAP_SCALE_M;
      }

      const activeScore = scoreLandingSite(
        {
          slopeDeg: activeSite.localSlopeDeg,
          illuminationPct: e.data.powerStats.illuminationFractionPct,
          dteUptimePct: e.data.dteStats.dteUptimePct,
          distanceToPsrM: distToPsr,
          criticalSlopeDeg,
        },
        siteWeights
      );

      set({
        horizonMaskDeg: e.data.horizonMaskDeg,
        powerStats: e.data.powerStats,
        dteStats: e.data.dteStats,
        activeScore,
        workerComputeMs: e.data.computeMs,
        computingHorizon: false,
      });
    };

    const [h, w] = demMeta.dimensions;
    worker.postMessage({
      requestId,
      elev,
      width: w,
      height: h,
      px: activeSite.px,
      py: activeSite.py,
      pixelSizeM: LOLA_MAP_SCALE_M,
      mastHeightM,
      siteLonDeg: activeSite.lonDeg,
      arrayModel,
      arrayAreaM2: 5.0,
      arrayEfficiency: 0.28,
      footprintM,
      ephemerisSteps: steps,
    });
  },

  setSiteWeights: (siteWeights) => set({ siteWeights }),

  runSiteFinder: () => {
    const {
      elev,
      demMeta,
      psrGrid,
      illumGrid,
      ephemeris,
      activeEphemerisKey,
      siteWeights,
      criticalSlopeDeg,
      mastHeightM,
      arrayModel,
    } = get();

    if (!elev || !demMeta || !psrGrid || !illumGrid || !ephemeris) return;
    const steps = ephemeris.sites[activeEphemerisKey]?.ephemeris;
    if (!steps) return;

    const worker = getScoringWorker();
    const requestId = ++latestScoringReqId;
    set({ findingSites: true });

    worker.onmessage = (e) => {
      if (e.data.requestId !== latestScoringReqId) return;
      set({
        finderResults: e.data.candidates,
        findingSites: false,
      });
    };

    const [h, w] = demMeta.dimensions;
    worker.postMessage({
      requestId,
      elev,
      width: w,
      height: h,
      pixelSizeM: LOLA_MAP_SCALE_M,
      psrMask: psrGrid,
      illumGrid,
      ephemerisSteps: steps,
      weights: siteWeights,
      criticalSlopeDeg,
      mastHeightM,
      arrayModel,
      topN: 8,
      stridePx: 32,
    });
  },

  pinCurrentSite: () => {
    const { activeSite, powerStats, dteStats, activeScore, pinnedSites } = get();
    if (!activeSite || !powerStats || !dteStats || !activeScore) return;
    const labels = ['Site A', 'Site B', 'Site C'];
    const idx = pinnedSites.length % 3;
    const snapshot: PinnedSiteSnapshot = {
      id: `${Date.now()}`,
      label: activeSite.name ?? `${labels[idx]} (${activeSite.latDeg.toFixed(2)}°)`,
      site: activeSite,
      powerStats,
      dteStats,
      score: activeScore,
    };
    const next = [...pinnedSites.slice(0, 2), snapshot];
    set({ pinnedSites: next });
  },

  removePinnedSite: (id) =>
    set((s) => ({ pinnedSites: s.pinnedSites.filter((p) => p.id !== id) })),

  setPickingTraverseGoal: (pickingTraverseGoal) => set({ pickingTraverseGoal }),
  setTraverseGoal: (traverseGoal) => set({ traverseGoal }),
  setMaxRoverSlopeDeg: (maxRoverSlopeDeg) => set({ maxRoverSlopeDeg }),
  setIlluminationAwareTraverse: (illuminationAwareTraverse) =>
    set({ illuminationAwareTraverse }),

  runTraverseToGoal: (goal) => {
    const {
      elev,
      demMeta,
      activeSite,
      illumGrid,
      maxRoverSlopeDeg,
      illuminationAwareTraverse,
    } = get();
    if (!elev || !demMeta || !activeSite) return;

    const worker = getTraverseWorker();
    const requestId = ++latestTraverseReqId;
    set({
      traverseGoal: goal,
      pickingTraverseGoal: false,
      computingTraverse: true,
    });

    worker.onmessage = (e) => {
      if (e.data.requestId !== latestTraverseReqId) return;
      set({
        traverseResult: e.data.result,
        computingTraverse: false,
      });
    };

    const [h, w] = demMeta.dimensions;
    worker.postMessage({
      requestId,
      elev,
      width: w,
      height: h,
      pixelSizeM: LOLA_MAP_SCALE_M,
      start: { px: Math.round(activeSite.px), py: Math.round(activeSite.py) },
      goal: { px: Math.round(goal.px), py: Math.round(goal.py) },
      options: {
        maxSlopeDeg: maxRoverSlopeDeg,
        roverMassKg: 200,
        rollingResistance: 0.1,
        illuminationGrid: illuminationAwareTraverse && illumGrid ? illumGrid : undefined,
        illuminationPenaltyWeight: illuminationAwareTraverse ? 2.5 : 0,
      },
    });
  },

  setUncertaintyRadiusM: (uncertaintyRadiusM) => {
    const { elev, illumGrid, activeSite } = get();
    const uncertaintyStats =
      uncertaintyRadiusM > 0 && elev && illumGrid && activeSite
        ? computeUncertaintyStats(elev, illumGrid, activeSite.px, activeSite.py, uncertaintyRadiusM)
        : null;
    set({ uncertaintyRadiusM, uncertaintyStats });
  },

  setPitchTour: (pitchTourActive, step) =>
    set((s) => ({
      pitchTourActive,
      pitchTourStep: step !== undefined ? step : s.pitchTourStep,
    })),
}));
