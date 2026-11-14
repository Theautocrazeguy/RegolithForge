import { Award, BookOpen, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AOI_DIM, LOLA_MAP_SCALE_M } from '../../core/types';
import { useRegolithStore } from '../../state/store';

type ReadingLevel = 'kid' | 'student' | 'engineer';

const GLOSSARY = [
  {
    term: 'Peak of Eternal Light (PEL)',
    kid: 'A super-tall mountain ridge near the Moon’s pole where the Sun shines almost all the time!',
    student: 'High crater rims at the lunar poles that stay sunlit for >80% of the month because the Moon barely tilts.',
    engineer: 'Topographic maxima with minimal horizon obstruction, maximizing solar array duty cycle (>80%) and thermal stability.',
  },
  {
    term: 'Permanently Shadowed Region (PSR)',
    kid: 'A super-cold crater bottom where sunlight never reaches, hiding ancient frozen water ice.',
    student: 'Deep polar crater floors shielded from low-angle sunlight for billions of years, staying below -160°C (110 K).',
    engineer: 'Cryogenic cold traps (<110 K surface temperature) where water-ice sublimation rates are negligible over geological timescales.',
  },
  {
    term: 'Direct-to-Earth (DTE)',
    kid: 'Beaming radio messages straight from our Moon lander to giant dish antennas on Earth.',
    student: 'Unobstructed radio line-of-sight between the lunar lander and NASA Deep Space Network (DSN) stations.',
    engineer: 'Geometric Earth LOS (EL_earth > horizon(AZ_earth)), experiencing ~1.28 s one-way light time and ~222 dB X-band FSPL.',
  },
];

export function ExplorerHUD() {
  const activeSite = useRegolithStore((s) => s.activeSite);
  const powerStats = useRegolithStore((s) => s.powerStats);
  const dteStats = useRegolithStore((s) => s.dteStats);
  const psrGrid = useRegolithStore((s) => s.psrGrid);
  const criticalSlopeDeg = useRegolithStore((s) => s.criticalSlopeDeg);

  const [level, setLevel] = useState<ReadingLevel>('student');
  const [tab, setTab] = useState<'challenges' | 'lessons' | 'glossary'>('challenges');

  // Compute distance to nearest PSR for Challenge 3
  const distToPsrM = useMemo(() => {
    if (!activeSite || !psrGrid) return 9999;
    const cx = Math.round(activeSite.px);
    const cy = Math.round(activeSite.py);
    let minSq = Infinity;
    for (let dy = -80; dy <= 80; dy += 4) {
      const sy = cy + dy;
      if (sy < 0 || sy >= AOI_DIM) continue;
      for (let dx = -80; dx <= 80; dx += 4) {
        const sx = cx + dx;
        if (sx < 0 || sx >= AOI_DIM) continue;
        if (psrGrid[sy * AOI_DIM + sx] > 127) {
          const dSq = dx * dx + dy * dy;
          if (dSq < minSq) minSq = dSq;
        }
      }
    }
    return Number.isFinite(minSq) ? Math.sqrt(minSq) * LOLA_MAP_SCALE_M : 9999;
  }, [activeSite, psrGrid]);

  const challenges = useMemo(() => {
    const slope = activeSite?.localSlopeDeg ?? 99;
    const sun = powerStats?.illuminationFractionPct ?? 0;
    const dte = dteStats?.dteUptimePct ?? 0;

    return [
      {
        id: 1,
        title: 'Challenge 1: The Eternal Beacon',
        desc:
          level === 'kid'
            ? 'Land on a bright ridge with lots of sunlight (≥80%) and a clear view of Earth (≥45%)!'
            : 'Select a safe site (≤15° slope) achieving ≥80% solar illumination and ≥45% DTE uptime.',
        passed: slope <= criticalSlopeDeg && sun >= 80 && dte >= 45,
        status: `Sun ${sun.toFixed(0)}% · DTE ${dte.toFixed(0)}%`,
      },
      {
        id: 2,
        title: 'Challenge 2: Smooth Touchdown',
        desc:
          level === 'kid'
            ? 'Find a flat spot (slope ≤10°) so your spaceship won’t tip over when landing!'
            : 'Locate a gentle landing pad with local 20m slope ≤10.0°.',
        passed: slope <= 10.0,
        status: `Local Slope ${slope.toFixed(1)}°`,
      },
      {
        id: 3,
        title: 'Challenge 3: Ice Harvester Base',
        desc:
          level === 'kid'
            ? 'Park within 1.5 km of icy crater shadows while keeping at least 50% sunlight!'
            : 'Land within 1,500 m of a PSR cold trap while maintaining ≥50% solar access and safe slope.',
        passed: slope <= criticalSlopeDeg && distToPsrM <= 1500 && sun >= 50,
        status: `PSR Dist ${(distToPsrM / 1000).toFixed(2)} km · Sun ${sun.toFixed(0)}%`,
      },
    ];
  }, [activeSite, powerStats, dteStats, distToPsrM, criticalSlopeDeg, level]);

  const passedCount = challenges.filter((c) => c.passed).length;

  return (
    <div className="flex flex-1 items-start justify-between p-3">
      {/* Left: Junior Astronaut Trainer Card */}
      <aside className="pointer-events-auto flex w-80 flex-col gap-2.5 rounded border border-[#1c2230] bg-[#06080d]/90 p-3 text-xs">
        <div className="flex items-center justify-between border-b border-[#1c2230] pb-2">
          <span className="flex items-center gap-1.5 font-semibold text-[#f5b041]">
            <Sparkles className="h-4 w-4" /> Junior Astronaut Trainer
          </span>
          <span className="rounded bg-[#f5b041]/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#f5b041]">
            {passedCount}/3 Complete
          </span>
        </div>

        {/* Reading Level Toggle */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400">Reading Level:</span>
          <div className="flex rounded border border-[#1c2230] bg-[#0b0f17] p-0.5">
            {(['kid', 'student', 'engineer'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevel(lvl)}
                className={`rounded px-2 py-0.5 capitalize ${
                  level === lvl ? 'bg-[#22d3ee] font-semibold text-[#06080d]' : 'text-slate-400'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Explorer Sub-Tabs */}
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <button
            onClick={() => setTab('challenges')}
            className={`flex items-center justify-center gap-1 rounded border py-1 ${
              tab === 'challenges'
                ? 'border-[#f5b041] bg-[#f5b041]/15 text-[#f5b041]'
                : 'border-[#1c2230] bg-[#0b0f17] text-slate-400'
            }`}
          >
            <Award className="h-3 w-3" /> Missions
          </button>
          <button
            onClick={() => setTab('lessons')}
            className={`flex items-center justify-center gap-1 rounded border py-1 ${
              tab === 'lessons'
                ? 'border-[#f5b041] bg-[#f5b041]/15 text-[#f5b041]'
                : 'border-[#1c2230] bg-[#0b0f17] text-slate-400'
            }`}
          >
            <Sparkles className="h-3 w-3" /> Why?
          </button>
          <button
            onClick={() => setTab('glossary')}
            className={`flex items-center justify-center gap-1 rounded border py-1 ${
              tab === 'glossary'
                ? 'border-[#f5b041] bg-[#f5b041]/15 text-[#f5b041]'
                : 'border-[#1c2230] bg-[#0b0f17] text-slate-400'
            }`}
          >
            <BookOpen className="h-3 w-3" /> Glossary
          </button>
        </div>

        {tab === 'challenges' && (
          <div className="flex flex-col gap-2">
            {challenges.map((c) => (
              <div
                key={c.id}
                className={`rounded border p-2 ${
                  c.passed
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-[#1c2230] bg-[#0b0f17]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{c.title}</span>
                  {c.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-600" />
                  )}
                </div>
                <p className="mt-1 text-[10px] text-slate-400">{c.desc}</p>
                <div className="mt-1 font-mono-num text-[9px] text-slate-300">{c.status}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'lessons' && (
          <div className="flex flex-col gap-2 text-[11px] text-slate-300">
            <div className="rounded border border-[#1c2230] bg-[#0b0f17] p-2">
              <div className="font-semibold text-[#f5b041]">Why Does the Sun Skim the Horizon?</div>
              <p className="mt-1 text-[10px] text-slate-400">
                {level === 'kid'
                  ? 'The Moon stands almost straight up! So at the South Pole, the Sun rolls around the horizon like a marble instead of rising high overhead.'
                  : 'Unlike Earth’s 23.4° tilt, the Moon’s spin axis tilts only 1.54° to the ecliptic. At the poles, the Sun circles 360° just above or below the horizon.'}
              </p>
            </div>
            <div className="rounded border border-[#1c2230] bg-[#0b0f17] p-2">
              <div className="font-semibold text-[#93c5fd]">Why Are Shadows Razor-Sharp?</div>
              <p className="mt-1 text-[10px] text-slate-400">
                {level === 'kid'
                  ? 'The Moon has no air to bounce sunlight around! Step into a shadow and it turns pitch black instantly.'
                  : 'With no atmosphere to scatter Rayleigh light, transitions from direct sunlight to shadow are governed solely by the 0.53° solar disc penumbra.'}
              </p>
            </div>
          </div>
        )}

        {tab === 'glossary' && (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="rounded border border-[#1c2230] bg-[#0b0f17] p-2">
                <div className="font-semibold text-[#22d3ee]">{g.term}</div>
                <p className="mt-0.5 text-[10px] text-slate-300">{g[level]}</p>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Right: Minimal 2m First-Person Viewport Reticle Info */}
      <div className="pointer-events-auto rounded border border-[#1c2230] bg-[#06080d]/85 px-3 py-2 text-[11px]">
        <div className="font-semibold text-slate-200">
          2m Deck Camera · {activeSite?.name ?? 'Custom Landing Site'}
        </div>
        <div className="font-mono-num text-[10px] text-slate-400">
          Drag to pan 360° · Scrub timeline below to watch the Sun skim the crater rim
        </div>
      </div>
    </div>
  );
}
