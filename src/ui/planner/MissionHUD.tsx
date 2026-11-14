import { useEffect, useMemo, useState } from 'react';
import { evaluateDteStep } from '../../core/dte';
import { sampleHorizonAtAzimuth } from '../../core/horizon';
import { computeArrayPowerWatts } from '../../core/power';
import { SolarArrayModel } from '../../core/types';
import { PlannerTab, useRegolithStore } from '../../state/store';
import { ExplorerHUD } from '../explorer/ExplorerHUD';
import { PerfHUD } from '../PerfHUD';
import { HorizonPolarChart } from './HorizonPolarChart';
import { MissionToolsPanel } from './MissionToolsPanel';
import { Modals } from './Modals';
import { ComparePanel, SiteFinderPanel } from './SiteFinderPanel';
import { SolarYieldChart } from './SolarYieldChart';
import { TimelineScrubber } from './TimelineScrubber';
import { TraversePanel } from './TraversePanel';

export function MissionHUD() {
  const demMeta = useRegolithStore((s) => s.demMeta);
  const ephemeris = useRegolithStore((s) => s.ephemeris);
  const activeEphemerisKey = useRegolithStore((s) => s.activeEphemerisKey);
  const stepIndex = useRegolithStore((s) => s.stepIndex);
  const activeSite = useRegolithStore((s) => s.activeSite);
  const horizonMaskDeg = useRegolithStore((s) => s.horizonMaskDeg);
  const powerStats = useRegolithStore((s) => s.powerStats);
  const dteStats = useRegolithStore((s) => s.dteStats);
  const activeScore = useRegolithStore((s) => s.activeScore);
  const workerComputeMs = useRegolithStore((s) => s.workerComputeMs);

  const mode = useRegolithStore((s) => s.mode);
  const cameraView = useRegolithStore((s) => s.cameraView);
  const activeTab = useRegolithStore((s) => s.activeTab);
  const mastHeightM = useRegolithStore((s) => s.mastHeightM);
  const criticalSlopeDeg = useRegolithStore((s) => s.criticalSlopeDeg);
  const arrayModel = useRegolithStore((s) => s.arrayModel);
  const colorBlindSafe = useRegolithStore((s) => s.colorBlindSafe);

  const showSlopeHazard = useRegolithStore((s) => s.showSlopeHazard);
  const showPelOverlay = useRegolithStore((s) => s.showPelOverlay);
  const showPsrOverlay = useRegolithStore((s) => s.showPsrOverlay);
  const showThermalOverlay = useRegolithStore((s) => s.showThermalOverlay);
  const showLabels = useRegolithStore((s) => s.showLabels);

  const setMode = useRegolithStore((s) => s.setMode);
  const setCameraView = useRegolithStore((s) => s.setCameraView);
  const setActiveTab = useRegolithStore((s) => s.setActiveTab);
  const setStepIndex = useRegolithStore((s) => s.setStepIndex);
  const setIsPlaying = useRegolithStore((s) => s.setIsPlaying);
  const setMastHeightM = useRegolithStore((s) => s.setMastHeightM);
  const setCriticalSlopeDeg = useRegolithStore((s) => s.setCriticalSlopeDeg);
  const setArrayModel = useRegolithStore((s) => s.setArrayModel);
  const toggleColorBlindSafe = useRegolithStore((s) => s.toggleColorBlindSafe);
  const setOverlay = useRegolithStore((s) => s.setOverlay);
  const setModal = useRegolithStore((s) => s.setModal);
  const selectBenchmarkSite = useRegolithStore((s) => s.selectBenchmarkSite);

  const [showPerfHud, setShowPerfHud] = useState(false);

  // Keyboard shortcuts for accessibility (Space: play/pause, Left/Right: +/-1h, E: Explorer, P: PerfHUD)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!useRegolithStore.getState().isPlaying);
      } else if (e.code === 'ArrowRight') {
        setStepIndex(useRegolithStore.getState().stepIndex + 1);
      } else if (e.code === 'ArrowLeft') {
        setStepIndex(useRegolithStore.getState().stepIndex - 1);
      } else if (e.key === 'e' || e.key === 'E') {
        setMode(useRegolithStore.getState().mode === 'planner' ? 'explorer' : 'planner');
      } else if (e.key === 'p' || e.key === 'P') {
        setShowPerfHud((v) => !v);
      } else if (e.key === 'f' || e.key === 'F') {
        setCameraView(useRegolithStore.getState().cameraView === 'site' ? 'globe' : 'site');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setIsPlaying, setStepIndex, setMode, setCameraView]);

  const steps = ephemeris?.sites[activeEphemerisKey]?.ephemeris ?? [];
  const currentStep = steps[stepIndex];

  const instantTelemetry = useMemo(() => {
    if (!currentStep || !horizonMaskDeg) return null;
    const sunHoriz = sampleHorizonAtAzimuth(horizonMaskDeg, currentStep.sun.azimuth_deg);
    const solar = computeArrayPowerWatts(
      currentStep.sun.elevation_deg,
      sunHoriz,
      currentStep.sun.heliocentric_distance_au,
      arrayModel,
      5.0,
      0.28
    );
    const dte = evaluateDteStep(currentStep, horizonMaskDeg);
    return { solar, dte, sunHoriz };
  }, [currentStep, horizonMaskDeg, arrayModel]);

  const demProvenance = demMeta?.provenance ?? 'REAL';
  const slopeHazardExceeded = (activeSite?.localSlopeDeg ?? 0) > criticalSlopeDeg;

  const TABS: { id: PlannerTab; label: string }[] = [
    { id: 'telemetry', label: 'Telemetry' },
    { id: 'finder', label: 'Finder' },
    { id: 'compare', label: 'A/B/C' },
    { id: 'traverse', label: 'Rover' },
    { id: 'tools', label: 'Tools' },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
      {/* TOP INSTRUMENT BAR */}
      <header className="pointer-events-auto flex h-10 items-center justify-between gap-2 border-b border-[#1c2230] bg-[#06080d]/95 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-xs font-semibold tracking-[0.16em] text-slate-100">
            REGOLITH<span className="text-[#f5b041]">FORGE</span>
          </span>
          <span className="hidden text-[#1c2230] lg:inline">|</span>
          <span className="hidden truncate font-mono-num text-[10px] uppercase tracking-wider text-slate-400 lg:inline">
            Shackleton · 89.9°S
          </span>
          <span className="hidden text-[#1c2230] xl:inline">|</span>
          <div className="hidden items-center gap-2.5 font-mono-num text-[10px] xl:flex">
            <span className={demProvenance === 'REAL' ? 'text-emerald-400' : 'text-red-400'}>
              LOLA 20m [{demProvenance}]
            </span>
            <span className="text-emerald-400">JPL-301 [REAL]</span>
            <span
              className="text-amber-400/90"
              title="20 m/pixel DEM cannot resolve meter-scale boulders or micro-craters"
            >
              DEM-resolution-limited (20 m/px)
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setModal('showAnalogsModal', true)}
            className="rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Analogs
          </button>
          <button
            onClick={() => setModal('showProvenanceModal', true)}
            className="rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Sources
          </button>
          <button
            onClick={() => setShowPerfHud((v) => !v)}
            className={`rounded border px-2 py-1 text-[10px] ${
              showPerfHud
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
                : 'border-[#1c2230] bg-[#0b0f17] text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle performance & worker latency HUD (Shortcut: P)"
            aria-label="Toggle performance HUD"
          >
            Perf
          </button>
          <button
            onClick={toggleColorBlindSafe}
            className={`rounded border px-2 py-1 text-[10px] ${
              colorBlindSafe
                ? 'border-sky-400/60 bg-sky-500/15 text-sky-300'
                : 'border-[#1c2230] bg-[#0b0f17] text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Okabe-Ito color-blind-safe palette"
          >
            {colorBlindSafe ? 'CB-Safe' : 'Standard'}
          </button>

          <div className="ml-1 flex rounded border border-[#1c2230] bg-[#0b0f17] p-0.5 text-[10px]">
            <button
              onClick={() => setCameraView('site')}
              className={`rounded px-2 py-0.5 font-medium ${
                cameraView === 'site' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Frame 20 km South Pole LOLA site (Shortcut: F)"
            >
              Site
            </button>
            <button
              onClick={() => {
                if (mode === 'explorer') setMode('planner');
                setCameraView('globe');
              }}
              className={`rounded px-2 py-0.5 font-medium ${
                cameraView === 'globe' ? 'bg-[#22d3ee] text-[#06080d]' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Zoom out to Full Moon orbital view (Shortcut: F)"
            >
              Full Moon
            </button>
          </div>

          <div className="flex rounded border border-[#1c2230] bg-[#0b0f17] p-0.5 text-[10px]">
            <button
              onClick={() => setMode('planner')}
              className={`rounded px-2 py-0.5 font-medium ${
                mode === 'planner' ? 'bg-[#f5b041] text-[#06080d]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Planner
            </button>
            <button
              onClick={() => setMode('explorer')}
              className={`rounded px-2 py-0.5 font-medium ${
                mode === 'explorer' ? 'bg-[#f5b041] text-[#06080d]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Explorer 2m
            </button>
          </div>
        </div>
      </header>

      {/* MIDDLE WORKSPACE */}
      {mode === 'planner' ? (
        <div className="flex min-h-0 flex-1 justify-between px-3 py-2">
          {/* LEFT PANEL: LAYERS & LANDER CONFIG */}
          <aside className="pointer-events-auto flex w-64 flex-col gap-3 overflow-y-auto rounded border border-[#1c2230] bg-[#06080d]/90 p-3">
            {/* Benchmark Sites */}
            <section>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Benchmark Sites
              </div>
              <div className="flex flex-col gap-1">
                {ephemeris &&
                  Object.entries(ephemeris.sites).map(([id, site]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setCameraView('site');
                        selectBenchmarkSite(id);
                      }}
                      className={`flex items-center justify-between rounded border px-2 py-1.5 text-left text-[11px] ${
                        activeSite?.name === site.name
                          ? 'border-[#f5b041]/60 bg-[#f5b041]/10 text-[#f5b041]'
                          : 'border-[#1c2230] bg-[#0b0f17] text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="truncate">{site.name}</span>
                      <span className="font-mono-num text-[9px] text-slate-500">
                        {site.lat.toFixed(2)}°
                      </span>
                    </button>
                  ))}
              </div>
            </section>

            {/* Terrain Shader Overlays */}
            <section className="border-t border-[#1c2230] pt-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <span>Shader Overlays</span>
                <span className="font-mono-num text-[9px] font-normal text-slate-500">DERIVED</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <label className="flex cursor-pointer items-center justify-between rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1.5">
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Slope Hazard
                  </span>
                  <input
                    type="checkbox"
                    checked={showSlopeHazard}
                    onChange={(e) => setOverlay('showSlopeHazard', e.target.checked)}
                    className="accent-[#ef4444]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1.5">
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-[#f5b041]" /> Peaks of Eternal Light
                  </span>
                  <input
                    type="checkbox"
                    checked={showPelOverlay}
                    onChange={(e) => setOverlay('showPelOverlay', e.target.checked)}
                    className="accent-[#f5b041]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1.5">
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-[#22d3ee]" /> PSR / Ice Cold Traps
                  </span>
                  <input
                    type="checkbox"
                    checked={showPsrOverlay}
                    onChange={(e) => setOverlay('showPsrOverlay', e.target.checked)}
                    className="accent-[#22d3ee]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1.5">
                  <span className="flex items-center gap-2 text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-purple-400" /> Thermal (Diviner)
                  </span>
                  <input
                    type="checkbox"
                    checked={showThermalOverlay}
                    onChange={(e) => setOverlay('showThermalOverlay', e.target.checked)}
                    className="accent-purple-400"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1.5">
                  <span className="text-[11px] text-slate-300">Feature Labels</span>
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setOverlay('showLabels', e.target.checked)}
                    className="accent-slate-400"
                  />
                </label>
              </div>
            </section>

            {/* Engineering Parameters */}
            <section className="border-t border-[#1c2230] pt-2.5">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Lander Parameters
              </div>

              <div className="mb-2.5">
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-slate-300">Critical Slope</span>
                  <span className="font-mono-num text-[#ef4444]">{criticalSlopeDeg}°</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={criticalSlopeDeg}
                  onChange={(e) => setCriticalSlopeDeg(Number(e.target.value))}
                  className="h-1 w-full cursor-pointer accent-[#ef4444]"
                />
              </div>

              <div className="mb-2.5">
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-slate-300">Solar Mast Height</span>
                  <span className="font-mono-num text-[#f5b041]">{mastHeightM} m</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[0, 2, 5, 10, 30].map((h) => (
                    <button
                      key={h}
                      onClick={() => setMastHeightM(h)}
                      className={`rounded border py-1 text-[10px] font-mono-num ${
                        mastHeightM === h
                          ? 'border-[#f5b041] bg-[#f5b041]/20 text-[#f5b041]'
                          : 'border-[#1c2230] bg-[#0b0f17] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {h}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] text-slate-300">Solar Array Model</div>
                <select
                  value={arrayModel}
                  onChange={(e) => setArrayModel(e.target.value as SolarArrayModel)}
                  className="w-full rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-[#f5b041]"
                >
                  <option value="vertical">Vertical Azimuth-Tracking</option>
                  <option value="dual">Two-Axis Gimbal Tracking</option>
                  <option value="horizontal">Fixed Horizontal Deck</option>
                </select>
              </div>
            </section>

            <div className="mt-auto border-t border-[#1c2230] pt-2 text-[10px] text-slate-500">
              Click 3D terrain to relocate lander. Worker raycast: {workerComputeMs.toFixed(1)} ms.
            </div>
          </aside>

          {/* RIGHT PANEL: TABBED TELEMETRY, SITE FINDER, COMPARE, ROVER, TOOLS */}
          <aside className="pointer-events-auto flex w-84 flex-col gap-2.5 overflow-y-auto rounded border border-[#1c2230] bg-[#06080d]/90 p-3">
            {/* Tab Bar */}
            <div className="grid grid-cols-5 gap-1 rounded border border-[#1c2230] bg-[#0b0f17] p-0.5 text-[10px]">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`rounded py-1 font-medium ${
                    activeTab === t.id
                      ? 'bg-[#f5b041] text-[#06080d]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'telemetry' && (
              <>
                {/* Site Coordinates & Composite Score */}
                <section>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Site Telemetry
                    </span>
                    <div className="flex items-center gap-1.5">
                      {activeScore && (
                        <span className="rounded bg-[#f5b041]/20 px-1.5 py-0.5 font-mono-num text-[9px] font-bold text-[#f5b041]">
                          SCORE {activeScore.totalScore}/100
                        </span>
                      )}
                      {slopeHazardExceeded ? (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-400">
                          HAZARD
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                          SAFE
                        </span>
                      )}
                    </div>
                  </div>

                  {activeSite && (
                    <div className="grid grid-cols-2 gap-1.5 rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-[11px]">
                      <div>
                        <div className="text-[9px] text-slate-500">LAT / LON</div>
                        <div className="font-mono-num text-slate-200">
                          {activeSite.latDeg.toFixed(3)}°, {activeSite.lonDeg.toFixed(2)}°E
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500">ELEVATION (R=1737.4km)</div>
                        <div className="font-mono-num text-slate-200">
                          {activeSite.elevM.toFixed(1)} m
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500">LOCAL SLOPE (20m)</div>
                        <div
                          className={`font-mono-num font-semibold ${
                            slopeHazardExceeded ? 'text-[#ef4444]' : 'text-emerald-400'
                          }`}
                        >
                          {activeSite.localSlopeDeg.toFixed(1)}°
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500">FOOTPRINT SLOPE (40m)</div>
                        <div className="font-mono-num text-slate-200">
                          {activeSite.footprintSlopeDeg.toFixed(1)}°
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Solar Power & Illumination */}
                <section className="border-t border-[#1c2230] pt-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Solar & Power (5 m² · 28%)
                    </span>
                    <span className="font-mono-num text-[10px] text-[#f5b041]">
                      {instantTelemetry ? `${instantTelemetry.solar.powerW.toFixed(0)} W` : '—'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-[10px]">
                    <div>
                      <div className="text-[9px] text-slate-500">SUNLIT</div>
                      <div className="font-mono-num text-sm font-semibold text-[#f5b041]">
                        {powerStats ? `${powerStats.illuminationFractionPct.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">TOTAL YIELD</div>
                      <div className="font-mono-num text-sm font-semibold text-slate-200">
                        {powerStats ? `${(powerStats.cumulativeEnergyWh / 1000).toFixed(1)} kWh` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">MAX DARK</div>
                      <div className="font-mono-num text-sm font-semibold text-slate-200">
                        {powerStats ? `${powerStats.longestDarknessHours}h` : '—'}
                      </div>
                    </div>
                  </div>
                </section>

                {/* DTE Geometric LOS */}
                <section className="border-t border-[#1c2230] pt-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      DTE Comms
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-mono-num font-semibold ${
                        instantTelemetry?.dte.visible
                          ? 'bg-[#93c5fd]/20 text-[#93c5fd]'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {instantTelemetry?.dte.visible ? 'LOS UP' : 'OCCLUDED'}
                    </span>
                  </div>
                  <div className="mb-1 text-[9px] text-slate-500">
                    Geometric LOS (unobstructed terrain vector)
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-[10px]">
                    <div>
                      <div className="text-[9px] text-slate-500">DTE UPTIME / BLACKOUT</div>
                      <div className="font-mono-num text-[#93c5fd]">
                        {dteStats ? `${dteStats.dteUptimePct.toFixed(1)}%` : '—'} ·{' '}
                        <span className="text-slate-300">
                          max {dteStats ? `${dteStats.longestBlackoutHours}h` : '—'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">LIGHT TIME / X-FSPL</div>
                      <div className="font-mono-num text-slate-200">
                        {instantTelemetry
                          ? `${instantTelemetry.dte.lightTimeS.toFixed(3)}s · ${instantTelemetry.dte.fsplXBandDb.toFixed(1)} dB`
                          : '—'}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[9px] text-slate-500">CANDIDATE DSN COMPLEX</div>
                      <div className="font-mono-num text-slate-300">
                        {instantTelemetry?.dte.dsnComplex ?? '—'}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 360° Polar Horizon Chart */}
                <section className="border-t border-[#1c2230] pt-2">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    360° Horizon Mask & Sky Paths
                  </div>
                  <HorizonPolarChart
                    horizonMaskDeg={horizonMaskDeg}
                    ephemerisSteps={steps}
                    stepIndex={stepIndex}
                  />
                </section>

                {/* Solar Yield Curve */}
                <section className="border-t border-[#1c2230] pt-2">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Solar Power Profile (W vs. Days)
                  </div>
                  <SolarYieldChart powerStats={powerStats} stepIndex={stepIndex} />
                </section>
              </>
            )}

            {activeTab === 'finder' && <SiteFinderPanel />}
            {activeTab === 'compare' && <ComparePanel />}
            {activeTab === 'traverse' && <TraversePanel />}
            {activeTab === 'tools' && <MissionToolsPanel />}
          </aside>
        </div>
      ) : (
        <ExplorerHUD />
      )}

      <Modals />
      <PerfHUD visible={showPerfHud} />

      {/* BOTTOM TIMELINE SCRUBBER */}
      <footer className="pointer-events-auto">
        <TimelineScrubber />
      </footer>
    </div>
  );
}
