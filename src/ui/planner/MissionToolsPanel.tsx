import {
  ArrowRightLeft,
  Calendar,
  FileText,
  PlayCircle,
  Target,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { computeSlopeAtPixel, sampleElevation } from '../../core/slope';
import { AOI_DIM, LOLA_MAP_SCALE_M } from '../../core/types';
import { useRegolithStore } from '../../state/store';

export function MissionToolsPanel() {
  const activeSite = useRegolithStore((s) => s.activeSite);
  const elev = useRegolithStore((s) => s.elev);
  const illumGrid = useRegolithStore((s) => s.illumGrid);
  const powerStats = useRegolithStore((s) => s.powerStats);
  const dteStats = useRegolithStore((s) => s.dteStats);
  const ephemeris = useRegolithStore((s) => s.ephemeris);
  const activeEphemerisKey = useRegolithStore((s) => s.activeEphemerisKey);
  const activeScore = useRegolithStore((s) => s.activeScore);
  const mastHeightM = useRegolithStore((s) => s.mastHeightM);
  const criticalSlopeDeg = useRegolithStore((s) => s.criticalSlopeDeg);
  const arrayModel = useRegolithStore((s) => s.arrayModel);

  const uncertaintyRadiusM = useRegolithStore((s) => s.uncertaintyRadiusM);
  const uncertaintyStats = useRegolithStore((s) => s.uncertaintyStats);
  const setUncertaintyRadiusM = useRegolithStore((s) => s.setUncertaintyRadiusM);
  const setStepIndex = useRegolithStore((s) => s.setStepIndex);
  const selectSiteByPixel = useRegolithStore((s) => s.selectSiteByPixel);
  const setPitchTour = useRegolithStore((s) => s.setPitchTour);

  const [missionDays, setMissionDays] = useState<7 | 14 | 30>(7);

  // Landing-Date Optimizer (F-13): ranks start hours for N-day mission window
  const optimalWindows = useMemo(() => {
    if (!powerStats || !dteStats || !ephemeris) return [];
    const steps = ephemeris.sites[activeEphemerisKey]?.ephemeris ?? [];
    const windowHrs = missionDays * 24;
    if (steps.length < windowHrs) return [];

    const results: { startIdx: number; utc: string; illumPct: number; dtePct: number }[] = [];
    const stepStride = missionDays === 30 ? 24 : 12;

    for (let s = 0; s <= steps.length - windowHrs; s += stepStride) {
      let sunSum = 0;
      let dteSum = 0;
      for (let k = s; k < s + windowHrs; k++) {
        sunSum += powerStats.hourlyIllumination[k];
        dteSum += dteStats.hourlyVisible[k];
      }
      results.push({
        startIdx: s,
        utc: steps[s].utc_time,
        illumPct: (sunSum / windowHrs) * 100,
        dtePct: (dteSum / windowHrs) * 100,
      });
    }

    results.sort((a, b) => b.illumPct * 0.65 + b.dtePct * 0.35 - (a.illumPct * 0.65 + a.dtePct * 0.35));
    return results.slice(0, 3);
  }, [powerStats, dteStats, ephemeris, activeEphemerisKey, missionDays]);

  // Scenario Comparator (F-32): Shift Lander +500m East along ridge
  const shiftComparison = useMemo(() => {
    if (!activeSite || !elev || !illumGrid) return null;
    const shiftPx = Math.round(500 / LOLA_MAP_SCALE_M); // 25 pixels = 500m
    const nx = Math.min(AOI_DIM - 2, Math.round(activeSite.px) + shiftPx);
    const ny = Math.round(activeSite.py);
    const newElev = sampleElevation(elev, AOI_DIM, AOI_DIM, nx, ny);
    const { slopeDeg: newSlope } = computeSlopeAtPixel(
      elev,
      AOI_DIM,
      AOI_DIM,
      nx,
      ny,
      LOLA_MAP_SCALE_M
    );
    const currentIllum = illumGrid[Math.round(activeSite.py) * AOI_DIM + Math.round(activeSite.px)] * 100;
    const newIllum = illumGrid[ny * AOI_DIM + nx] * 100;

    return {
      nx,
      ny,
      newElev,
      newSlope,
      currentIllum,
      newIllum,
    };
  }, [activeSite, elev, illumGrid]);

  // One-Click Mission Report Export (F-44)
  const exportMissionReport = () => {
    if (!activeSite || !powerStats || !dteStats || !activeScore) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>RegolithForge Mission Dossier</title>
<style>body{font-family:system-ui,sans-serif;max-width:780px;margin:32px auto;color:#0f172a;line-height:1.5}
h1{border-bottom:2px solid #f5b041;padding-bottom:8px} .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.card{border:1px solid #cbd5e1;padding:12px;border-radius:6px;background:#f8fafc} .tag{font-size:11px;font-weight:700;color:#059669}</style></head>
<body>
<h1>RegolithForge — Lunar Landing Site Mission Briefing</h1>
<p><span class="tag">PROVENANCE: REAL NASA LOLA 20m DEM + REAL JPL HORIZONS (BODY 301)</span></p>
<div class="grid">
  <div class="card"><strong>Target Coordinates</strong><br/>Lat: ${activeSite.latDeg.toFixed(4)}° · Lon: ${activeSite.lonDeg.toFixed(3)}°E<br/>Elevation: ${activeSite.elevM.toFixed(1)} m (R=1737.4 km)</div>
  <div class="card"><strong>Terrain & Safety</strong><br/>Local Slope (20m): ${activeSite.localSlopeDeg.toFixed(1)}°<br/>Footprint Slope (40m): ${activeSite.footprintSlopeDeg.toFixed(1)}°<br/>Status: ${activeScore.feasible ? 'SAFE' : 'HAZARD'} (Limit ${criticalSlopeDeg}°)</div>
  <div class="card"><strong>Solar & Power (${arrayModel}, Mast ${mastHeightM}m)</strong><br/>Sunlit Fraction: ${powerStats.illuminationFractionPct.toFixed(1)}%<br/>Cumulative Energy: ${(powerStats.cumulativeEnergyWh / 1000).toFixed(1)} kWh<br/>Longest Darkness: ${powerStats.longestDarknessHours} hrs</div>
  <div class="card"><strong>DTE Geometric LOS</strong><br/>DTE Uptime: ${dteStats.dteUptimePct.toFixed(1)}%<br/>Longest Blackout: ${dteStats.longestBlackoutHours} hrs<br/>Label: Geometric LOS (unobstructed terrain vector)</div>
</div>
<h2>Composite Score Breakdown: ${activeScore.totalScore} / 100</h2>
<ul><li>Slope Score: ${activeScore.slopeScore}</li><li>Illumination Score: ${activeScore.illuminationScore}</li><li>DTE Score: ${activeScore.dteScore}</li><li>Ice Proximity Score: ${activeScore.iceScore}</li></ul>
<p><em>Caveat: DEM-resolution-limited (20 m/px cannot resolve meter-scale boulders or micro-craters).</em></p>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'regolithforge_mission_dossier.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      {/* Guided Pitch Tour + Report Export */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setPitchTour(true, 0)}
          className="flex items-center justify-center gap-1 rounded bg-[#f5b041] px-2 py-1.5 text-[10px] font-semibold text-[#06080d] hover:bg-[#fbbf24]"
        >
          <PlayCircle className="h-3.5 w-3.5" /> Pitch Tour
        </button>
        <button
          onClick={exportMissionReport}
          className="flex items-center justify-center gap-1 rounded border border-[#1c2230] bg-[#0b0f17] px-2 py-1.5 text-[10px] text-slate-200 hover:border-[#f5b041]/60"
        >
          <FileText className="h-3.5 w-3.5 text-[#f5b041]" /> Export Dossier
        </button>
      </div>

      {/* Landing Uncertainty Ellipse (F-28) */}
      <div className="rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-[10px]">
        <div className="mb-1 flex items-center justify-between font-semibold text-slate-300">
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3 text-[#ef4444]" /> Landing Dispersion Ellipse
          </span>
          <span className="font-mono-num text-[#ef4444]">
            {uncertaintyRadiusM === 0 ? 'OFF' : `±${uncertaintyRadiusM} m`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={100}
          value={uncertaintyRadiusM}
          onChange={(e) => setUncertaintyRadiusM(Number(e.target.value))}
          className="h-1 w-full cursor-pointer accent-[#ef4444]"
        />
        {uncertaintyStats && (
          <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono-num text-[9px] text-slate-400">
            <span>
              Worst Slope:{' '}
              <strong className="text-[#ef4444]">{uncertaintyStats.worstSlopeDeg}°</strong>
            </span>
            <span>
              Sun Range:{' '}
              <strong className="text-[#f5b041]">
                {uncertaintyStats.minIllumPct}–{uncertaintyStats.maxIllumPct}%
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Landing-Date Optimizer (F-13) */}
      <div className="rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-[10px]">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold text-slate-300">
            <Calendar className="h-3 w-3 text-[#f5b041]" /> Landing-Date Optimizer
          </span>
          <div className="flex gap-1">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setMissionDays(d)}
                className={`rounded px-1.5 py-0.5 font-mono-num text-[9px] ${
                  missionDays === d
                    ? 'bg-[#f5b041]/20 text-[#f5b041]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {optimalWindows.map((w, i) => (
            <button
              key={w.startIdx}
              onClick={() => setStepIndex(w.startIdx)}
              className="flex items-center justify-between rounded border border-[#1c2230] bg-[#06080d] px-2 py-1 text-left hover:border-[#f5b041]/50"
            >
              <span className="font-mono-num text-[9px] text-slate-200">
                #{i + 1} {w.utc}
              </span>
              <span className="font-mono-num text-[9px] text-[#f5b041]">
                Sun {w.illumPct.toFixed(0)}% · DTE {w.dtePct.toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Comparator: +500m Shift (F-32) */}
      {shiftComparison && activeSite && (
        <div className="rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-[10px]">
          <div className="mb-1 flex items-center justify-between font-semibold text-slate-300">
            <span className="flex items-center gap-1">
              <ArrowRightLeft className="h-3 w-3 text-[#93c5fd]" /> +500m East Shift Check
            </span>
            <button
              onClick={() =>
                selectSiteByPixel(shiftComparison.nx, shiftComparison.ny, 'Shifted +500m E')
              }
              className="rounded border border-[#93c5fd]/40 px-1.5 py-0.5 text-[9px] text-[#93c5fd] hover:bg-[#93c5fd]/10"
            >
              Apply Shift
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 font-mono-num text-[9px] text-slate-400">
            <span>
              Slope: {activeSite.localSlopeDeg.toFixed(1)}° →{' '}
              <strong className="text-slate-200">{shiftComparison.newSlope.toFixed(1)}°</strong>
            </span>
            <span>
              Map Sun: {shiftComparison.currentIllum.toFixed(0)}% →{' '}
              <strong className="text-[#f5b041]">{shiftComparison.newIllum.toFixed(0)}%</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
