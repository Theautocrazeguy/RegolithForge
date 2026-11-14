import { ChevronRight, Database, Globe, X } from 'lucide-react';
import { useRegolithStore } from '../../state/store';

export function Modals() {
  const showProvenanceModal = useRegolithStore((s) => s.showProvenanceModal);
  const showAnalogsModal = useRegolithStore((s) => s.showAnalogsModal);
  const setModal = useRegolithStore((s) => s.setModal);
  const demMeta = useRegolithStore((s) => s.demMeta);
  const analogsData = useRegolithStore((s) => s.analogsData);
  const activeSite = useRegolithStore((s) => s.activeSite);
  const powerStats = useRegolithStore((s) => s.powerStats);

  const pitchTourActive = useRegolithStore((s) => s.pitchTourActive);
  const pitchTourStep = useRegolithStore((s) => s.pitchTourStep);
  const setPitchTour = useRegolithStore((s) => s.setPitchTour);
  const selectBenchmarkSite = useRegolithStore((s) => s.selectBenchmarkSite);
  const setOverlay = useRegolithStore((s) => s.setOverlay);
  const setMode = useRegolithStore((s) => s.setMode);

  const TOUR_BEATS = [
    {
      title: '1. Real NASA LOLA 20m South Polar Terrain',
      caption:
        'Every pixel in this 20.48 km × 20.48 km tile is extracted from NASA LRO LOLA LDEM_875S_20M with 16-bit/Float32 precision and Moon-centered JPL Horizons (Body 301) ephemeris.',
      action: () => {
        setMode('planner');
        setOverlay('showSlopeHazard', false);
        setOverlay('showPelOverlay', false);
        setOverlay('showPsrOverlay', false);
        selectBenchmarkSite('connecting_ridge_primary');
      },
    },
    {
      title: '2. Connecting Ridge: Peaks of Eternal Light vs. Slope Hazards',
      caption:
        'Shader overlays reveal safe landing corridors (<15° slope) along Connecting Ridge where a 2m solar mast captures ~86% continuous sunlight across the 29.5-day synodic month.',
      action: () => {
        setOverlay('showSlopeHazard', true);
        setOverlay('showPelOverlay', true);
      },
    },
    {
      title: '3. Permanently Shadowed Cold Traps & Water Ice',
      caption:
        'Just kilometers away, Shackleton Crater’s interior stays in permanent shadow (<80 K), trapping water-equivalent hydrogen detectable by neutron spectroscopy.',
      action: () => {
        setOverlay('showSlopeHazard', false);
        setOverlay('showPsrOverlay', true);
        selectBenchmarkSite('shackleton_rim');
      },
    },
    {
      title: '4. Junior Astronaut Explorer Mode (2m Deck View)',
      caption:
        'Switch to 2m first-person astronaut perspective to experience how the Sun skims the horizon and why lunar shadows are razor-sharp in vacuum.',
      action: () => {
        setMode('explorer');
      },
    },
  ];

  const advanceTour = () => {
    const next = pitchTourStep + 1;
    if (next >= TOUR_BEATS.length) {
      setMode('planner');
      setPitchTour(false, 0);
    } else {
      TOUR_BEATS[next].action();
      setPitchTour(true, next);
    }
  };

  return (
    <>
      {/* GUIDED PITCH TOUR CAPTION BAR */}
      {pitchTourActive && (
        <div className="pointer-events-auto fixed bottom-24 left-1/2 z-40 w-full max-w-xl -translate-x-1/2 rounded border border-[#f5b041]/60 bg-[#06080d]/95 p-3 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[#f5b041]">
                {TOUR_BEATS[pitchTourStep]?.title}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                {TOUR_BEATS[pitchTourStep]?.caption}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={advanceTour}
                className="flex items-center gap-1 rounded bg-[#f5b041] px-2.5 py-1 text-[11px] font-semibold text-[#06080d]"
              >
                {pitchTourStep < TOUR_BEATS.length - 1 ? 'Next' : 'Finish'}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setMode('planner');
                  setPitchTour(false, 0);
                }}
                className="rounded border border-[#1c2230] p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATA PROVENANCE MODAL */}
      {showProvenanceModal && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded border border-[#1c2230] bg-[#090d14] p-5 text-xs">
            <div className="mb-3 flex items-center justify-between border-b border-[#1c2230] pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Database className="h-4 w-4 text-[#f5b041]" /> Data Provenance & Citations
              </div>
              <button
                onClick={() => setModal('showProvenanceModal', false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-[11px] text-slate-300">
              <div className="rounded border border-[#1c2230] bg-[#06080d] p-2.5">
                <div className="font-semibold text-emerald-400">
                  [REAL] NASA LRO LOLA South Polar DEM (LDEM_875S_20M)
                </div>
                <p className="mt-1 text-slate-400">
                  {demMeta?.citation ??
                    'Smith, D. E. et al. (2017), LRO-L-LOLA-4-GDR-V1.0, NASA PDS Geosciences Node.'}{' '}
                  20 m/pixel polar stereographic projection (R = 1,737,400 m).
                </p>
              </div>
              <div className="rounded border border-[#1c2230] bg-[#06080d] p-2.5">
                <div className="font-semibold text-emerald-400">
                  [REAL] NASA/JPL Horizons Ephemeris (Observer Body 301)
                </div>
                <p className="mt-1 text-slate-400">
                  Topocentric Sun (10) & Earth (399) positions queried on Moon surface (airless) for 2026-Oct-01 to 2026-Oct-30. Verified against Horizons Web Interface in docs/DATA_VALIDATION.md.
                </p>
              </div>
              <div className="rounded border border-[#1c2230] bg-[#06080d] p-2.5">
                <div className="font-semibold text-[#f5b041]">
                  [DERIVED] Slope, Curvature-Corrected Horizon, Illumination & PSRs
                </div>
                <p className="mt-1 text-slate-400">
                  Computed deterministically from the 20m DEM using central differences, lunar curvature drop d²/(2R), and 0.533° extended solar disc integration. Thermal & WEH ice proxies follow Paige et al. (2010) and Sanin et al. (2017).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TERRESTRIAL ANALOGS MODAL (F-33) */}
      {showAnalogsModal && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded border border-[#1c2230] bg-[#090d14] p-5 text-xs">
            <div className="mb-3 flex items-center justify-between border-b border-[#1c2230] pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Globe className="h-4 w-4 text-[#22d3ee]" /> Earth Analogs for Lunar Outposts
              </div>
              <button
                onClick={() => setModal('showAnalogsModal', false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeSite && (
              <div className="mb-3 rounded border border-[#f5b041]/40 bg-[#f5b041]/10 p-2.5 text-[11px]">
                <strong className="text-[#f5b041]">Active Lunar Site Baseline:</strong> Slope{' '}
                {activeSite.localSlopeDeg.toFixed(1)}° · Sunlit{' '}
                {powerStats ? `${powerStats.illuminationFractionPct.toFixed(1)}%` : '—'} · Thermal
                Range ~40–225 K (Diviner benchmark)
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {(analogsData?.sites ?? []).map((site: Record<string, unknown>) => {
                const slope = site.slope_distribution as { median_deg: number };
                const solar = site.solar_access as {
                  peak_irradiance_w_m2: number;
                  diurnal_fraction_pct: number;
                };
                const therm = site.thermal_range_k as { min_k: number; max_k: number };
                return (
                  <div
                    key={String(site.id)}
                    className="rounded border border-[#1c2230] bg-[#06080d] p-3 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{String(site.name)}</span>
                      <span className="text-[10px] text-[#22d3ee]">{String(site.type)}</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-2 font-mono-num text-[10px] text-slate-300">
                      <span>Median Slope: {slope?.median_deg}°</span>
                      <span>
                        Solar: {solar?.diurnal_fraction_pct}% ({solar?.peak_irradiance_w_m2} W/m²)
                      </span>
                      <span>
                        Temp: {therm?.min_k}–{therm?.max_k} K
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-400">{String(site.primary_analog_use)}</p>
                    <p className="mt-1 text-[9px] italic text-slate-500">
                      Source: {String(site.citation)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
