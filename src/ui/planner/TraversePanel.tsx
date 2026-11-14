import { Crosshair, Download, Navigation, Sun } from 'lucide-react';
import { localPixelToLatLon } from '../../core/azEl';
import { AOI_DIM } from '../../core/types';
import { useRegolithStore } from '../../state/store';

export function TraversePanel() {
  const activeSite = useRegolithStore((s) => s.activeSite);
  const psrGrid = useRegolithStore((s) => s.psrGrid);
  const pickingTraverseGoal = useRegolithStore((s) => s.pickingTraverseGoal);
  const setPickingTraverseGoal = useRegolithStore((s) => s.setPickingTraverseGoal);
  const maxRoverSlopeDeg = useRegolithStore((s) => s.maxRoverSlopeDeg);
  const setMaxRoverSlopeDeg = useRegolithStore((s) => s.setMaxRoverSlopeDeg);
  const illuminationAwareTraverse = useRegolithStore((s) => s.illuminationAwareTraverse);
  const setIlluminationAwareTraverse = useRegolithStore((s) => s.setIlluminationAwareTraverse);
  const traverseResult = useRegolithStore((s) => s.traverseResult);
  const computingTraverse = useRegolithStore((s) => s.computingTraverse);
  const runTraverseToGoal = useRegolithStore((s) => s.runTraverseToGoal);

  const routeToNearestPsr = () => {
    if (!activeSite || !psrGrid) return;
    const cx = Math.round(activeSite.px);
    const cy = Math.round(activeSite.py);
    let bestPx = cx;
    let bestPy = cy;
    let minSq = Infinity;

    for (let y = 16; y < AOI_DIM - 16; y += 4) {
      for (let x = 16; x < AOI_DIM - 16; x += 4) {
        if (psrGrid[y * AOI_DIM + x] > 127) {
          const dSq = (x - cx) ** 2 + (y - cy) ** 2;
          if (dSq < minSq) {
            minSq = dSq;
            bestPx = x;
            bestPy = y;
          }
        }
      }
    }
    if (Number.isFinite(minSq)) {
      runTraverseToGoal({ px: bestPx, py: bestPy });
    }
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportGeoJson = () => {
    if (!traverseResult || !traverseResult.found) return;
    const coords = traverseResult.path.map((pt) => {
      const { latDeg, lonDeg } = localPixelToLatLon(pt.px, pt.py);
      return [lonDeg, latDeg];
    });
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            distance_m: traverseResult.totalDistanceM,
            energy_wh: traverseResult.totalEnergyWh,
            max_slope_deg: traverseResult.maxSlopeEncounteredDeg,
            est_hours: traverseResult.estimatedTimeHours,
          },
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        },
      ],
    };
    downloadFile(JSON.stringify(geojson, null, 2), 'regolithforge_route.geojson', 'application/geo+json');
  };

  const exportCsv = () => {
    if (!traverseResult || !traverseResult.found) return;
    const rows = ['waypoint,px,py,lat_deg,lon_deg'];
    traverseResult.path.forEach((pt, idx) => {
      const { latDeg, lonDeg } = localPixelToLatLon(pt.px, pt.py);
      rows.push(`${idx},${pt.px},${pt.py},${latDeg.toFixed(6)},${lonDeg.toFixed(6)}`);
    });
    downloadFile(rows.join('\n'), 'regolithforge_route.csv', 'text/csv');
  };

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Autonomous Rover Traverse (A*)
      </div>

      <div className="flex flex-col gap-2 rounded border border-[#1c2230] bg-[#0b0f17] p-2 text-[10px]">
        <div>
          <div className="mb-1 flex justify-between text-slate-300">
            <span>Max Rover Slope Limit</span>
            <span className="font-mono-num text-[#22d3ee]">{maxRoverSlopeDeg}°</span>
          </div>
          <input
            type="range"
            min={8}
            max={25}
            step={1}
            value={maxRoverSlopeDeg}
            onChange={(e) => setMaxRoverSlopeDeg(Number(e.target.value))}
            className="h-1 w-full cursor-pointer accent-[#22d3ee]"
          />
        </div>

        <label className="flex cursor-pointer items-center justify-between text-slate-300">
          <span className="flex items-center gap-1.5">
            <Sun className="h-3 w-3 text-[#f5b041]" /> Prefer Sunlit Segments
          </span>
          <input
            type="checkbox"
            checked={illuminationAwareTraverse}
            onChange={(e) => setIlluminationAwareTraverse(e.target.checked)}
            className="accent-[#f5b041]"
          />
        </label>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            onClick={() => setPickingTraverseGoal(!pickingTraverseGoal)}
            className={`flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-[10px] font-medium ${
              pickingTraverseGoal
                ? 'border-[#22d3ee] bg-[#22d3ee]/20 text-[#22d3ee]'
                : 'border-[#1c2230] bg-[#06080d] text-slate-200 hover:border-[#22d3ee]/60'
            }`}
          >
            <Crosshair className="h-3 w-3" />
            {pickingTraverseGoal ? 'Click 3D Map...' : 'Pick Target'}
          </button>

          <button
            onClick={routeToNearestPsr}
            className="flex items-center justify-center gap-1 rounded bg-[#22d3ee] px-2 py-1.5 text-[10px] font-semibold text-[#06080d] hover:bg-[#67e8f9]"
          >
            <Navigation className="h-3 w-3" /> Nearest PSR
          </button>
        </div>
      </div>

      {computingTraverse && (
        <div className="text-center text-[11px] text-[#22d3ee]">Computing A* route...</div>
      )}

      {traverseResult && !computingTraverse && (
        <div className="rounded border border-[#1c2230] bg-[#0b0f17] p-2">
          {!traverseResult.found ? (
            <div className="text-[11px] text-red-400">
              No traversable route found under {maxRoverSlopeDeg}° slope constraint. Increase max slope or pick an alternate target.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div>
                  <div className="text-[9px] text-slate-500">DISTANCE</div>
                  <div className="font-mono-num text-sm font-semibold text-[#22d3ee]">
                    {(traverseResult.totalDistanceM / 1000).toFixed(2)} km
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500">MECH. ENERGY</div>
                  <div className="font-mono-num text-sm font-semibold text-[#f5b041]">
                    {traverseResult.totalEnergyWh.toFixed(1)} Wh
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500">MAX SLOPE</div>
                  <div className="font-mono-num text-slate-200">
                    {traverseResult.maxSlopeEncounteredDeg.toFixed(1)}°
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500">EST. TIME / SUNLIT</div>
                  <div className="font-mono-num text-slate-200">
                    {traverseResult.estimatedTimeHours.toFixed(1)}h ·{' '}
                    {Math.round(traverseResult.sunlitFraction * 100)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 border-t border-[#1c2230] pt-2">
                <button
                  onClick={exportGeoJson}
                  className="flex items-center justify-center gap-1 rounded border border-[#1c2230] bg-[#06080d] py-1 text-[10px] text-slate-300 hover:border-slate-500"
                >
                  <Download className="h-3 w-3" /> GeoJSON
                </button>
                <button
                  onClick={exportCsv}
                  className="flex items-center justify-center gap-1 rounded border border-[#1c2230] bg-[#06080d] py-1 text-[10px] text-slate-300 hover:border-slate-500"
                >
                  <Download className="h-3 w-3" /> CSV
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
