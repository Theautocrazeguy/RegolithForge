import { BookmarkPlus, Search, Trash2 } from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRegolithStore } from '../../state/store';

export function SiteFinderPanel() {
  const siteWeights = useRegolithStore((s) => s.siteWeights);
  const setSiteWeights = useRegolithStore((s) => s.setSiteWeights);
  const runSiteFinder = useRegolithStore((s) => s.runSiteFinder);
  const finderResults = useRegolithStore((s) => s.finderResults);
  const findingSites = useRegolithStore((s) => s.findingSites);
  const selectSiteByPixel = useRegolithStore((s) => s.selectSiteByPixel);

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Auto Site Finder (Web Worker)
      </div>

      {/* Criteria Weight Sliders */}
      <div className="flex flex-col gap-1.5 rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-[10px]">
        {(
          [
            ['slope', 'Slope Safety', '#34d399'],
            ['illumination', 'Solar Illumination', '#f5b041'],
            ['dte', 'DTE Comms Uptime', '#93c5fd'],
            ['iceProximity', 'PSR Ice Proximity', '#22d3ee'],
          ] as const
        ).map(([key, label, col]) => (
          <div key={key}>
            <div className="flex justify-between text-slate-300">
              <span>{label}</span>
              <span className="font-mono-num" style={{ color: col }}>
                {Math.round(siteWeights[key] * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={siteWeights[key]}
              onChange={(e) =>
                setSiteWeights({ ...siteWeights, [key]: Number(e.target.value) })
              }
              className="h-1 w-full cursor-pointer accent-[#f5b041]"
            />
          </div>
        ))}

        <button
          onClick={runSiteFinder}
          disabled={findingSites}
          className="mt-1 flex items-center justify-center gap-1.5 rounded bg-[#f5b041] px-2.5 py-1.5 text-[11px] font-semibold text-[#06080d] hover:bg-[#fbbf24] disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
          {findingSites ? 'Scanning AOI...' : 'Find Top Landing Sites'}
        </button>
      </div>

      {/* Ranked Candidates */}
      {finderResults.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {finderResults.map((c, idx) => (
            <button
              key={`${c.px}-${c.py}`}
              onClick={() =>
                selectSiteByPixel(c.px, c.py, `Ranked #${idx + 1} (${c.breakdown.totalScore})`)
              }
              className="flex flex-col gap-1 rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-left hover:border-[#f5b041]/60"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">
                  #{idx + 1} · {c.latDeg.toFixed(3)}°, {c.lonDeg.toFixed(1)}°E
                </span>
                <span className="rounded bg-[#f5b041]/20 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#f5b041]">
                  {c.breakdown.totalScore.toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 font-mono-num text-[9px] text-slate-400">
                <span>Slope {c.slopeDeg.toFixed(1)}°</span>
                <span className="text-[#f5b041]">Sun {c.illuminationPct.toFixed(0)}%</span>
                <span className="text-[#93c5fd]">DTE {c.dteUptimePct.toFixed(0)}%</span>
                <span className="text-[#22d3ee]">PSR {(c.distanceToPsrM / 1000).toFixed(1)}km</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ComparePanel() {
  const pinnedSites = useRegolithStore((s) => s.pinnedSites);
  const pinCurrentSite = useRegolithStore((s) => s.pinCurrentSite);
  const removePinnedSite = useRegolithStore((s) => s.removePinnedSite);

  const colors = ['#f5b041', '#22d3ee', '#93c5fd'];

  // Build overlaid solar yield chart data
  const chartData = [];
  if (pinnedSites.length > 0) {
    const len = pinnedSites[0].powerStats.hourlyPowerW.length;
    for (let i = 0; i < len; i += 8) {
      const row: Record<string, number> = { day: Math.round((i / 24) * 10) / 10 };
      pinnedSites.forEach((p, idx) => {
        row[`s${idx}`] = Math.round(p.powerStats.hourlyPowerW[i] ?? 0);
      });
      chartData.push(row);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          A/B/C Site Comparison
        </span>
        <button
          onClick={pinCurrentSite}
          className="flex items-center gap-1 rounded border border-[#f5b041]/50 bg-[#f5b041]/10 px-2 py-0.5 text-[10px] text-[#f5b041] hover:bg-[#f5b041]/20"
        >
          <BookmarkPlus className="h-3 w-3" /> Pin Current
        </button>
      </div>

      {pinnedSites.length === 0 ? (
        <div className="rounded border border-dashed border-[#1c2230] p-3 text-center text-[11px] text-slate-500">
          Click "Pin Current" to compare up to 3 candidate sites side-by-side.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {pinnedSites.map((p, idx) => (
              <div
                key={p.id}
                className="flex flex-col gap-1 rounded border border-[#1c2230] bg-[#0b0f17] p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-slate-200">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: colors[idx % 3] }}
                    />
                    <span className="truncate max-w-[160px]">{p.label}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-num text-[10px] font-bold text-[#f5b041]">
                      Score {p.score.totalScore}
                    </span>
                    <button
                      onClick={() => removePinnedSite(p.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 font-mono-num text-[9px] text-slate-400">
                  <span>Slope {p.site.localSlopeDeg.toFixed(1)}°</span>
                  <span>Sun {p.powerStats.illuminationFractionPct.toFixed(1)}%</span>
                  <span>DTE {p.dteStats.dteUptimePct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded border border-[#1c2230] bg-[#0b0f17] p-2">
            <div className="mb-1 text-[9px] uppercase text-slate-400">
              Overlaid Solar Power (W vs. Days)
            </div>
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#64748b' }} stroke="#1e293b" />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} stroke="#1e293b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#06080d',
                      borderColor: '#1e293b',
                      fontSize: '10px',
                    }}
                  />
                  {pinnedSites.map((p, idx) => (
                    <Line
                      key={p.id}
                      type="monotone"
                      dataKey={`s${idx}`}
                      name={p.label}
                      stroke={colors[idx % 3]}
                      dot={false}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
