import { useMemo } from 'react';
import { EphemerisStep } from '../../core/types';

interface HorizonPolarChartProps {
  horizonMaskDeg: Float32Array | null;
  ephemerisSteps: EphemerisStep[];
  stepIndex: number;
}

const SIZE = 220;
const CENTER = SIZE / 2;
const MAX_R = 86;
// Map elevation [-10°, +30°] -> [MAX_R, 0] (0° horizon is at r ~ 64.5)
function elToRadius(elDeg: number): number {
  const clamped = Math.max(-10, Math.min(30, elDeg));
  return MAX_R * ((30 - clamped) / 40);
}

function polarToXY(azDeg: number, elDeg: number): [number, number] {
  const r = elToRadius(elDeg);
  const rad = (azDeg * Math.PI) / 180;
  return [CENTER + r * Math.sin(rad), CENTER - r * Math.cos(rad)];
}

export function HorizonPolarChart({
  horizonMaskDeg,
  ephemerisSteps,
  stepIndex,
}: HorizonPolarChartProps) {
  const horizonPolygon = useMemo(() => {
    if (!horizonMaskDeg) return '';
    const pts: string[] = [];
    // Outer ring boundary (at -10 deg) so we fill the blocked lower terrain
    for (let az = 0; az < 360; az += 2) {
      const [x, y] = polarToXY(az, horizonMaskDeg[az]);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [horizonMaskDeg]);

  const { sunPath, earthPath } = useMemo(() => {
    if (!ephemerisSteps.length) return { sunPath: '', earthPath: '' };
    const sPts: string[] = [];
    const ePts: string[] = [];
    for (let i = 0; i < ephemerisSteps.length; i += 3) {
      const s = ephemerisSteps[i];
      const [sx, sy] = polarToXY(s.sun.azimuth_deg, s.sun.elevation_deg);
      const [ex, ey] = polarToXY(s.earth.azimuth_deg, s.earth.elevation_deg);
      sPts.push(`${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`);
      ePts.push(`${i === 0 ? 'M' : 'L'}${ex.toFixed(1)},${ey.toFixed(1)}`);
    }
    return { sunPath: sPts.join(' '), earthPath: ePts.join(' ') };
  }, [ephemerisSteps]);

  const currentStep = ephemerisSteps[stepIndex];
  const sunPt = currentStep
    ? polarToXY(currentStep.sun.azimuth_deg, currentStep.sun.elevation_deg)
    : null;
  const earthPt = currentStep
    ? polarToXY(currentStep.earth.azimuth_deg, currentStep.earth.elevation_deg)
    : null;

  return (
    <div className="flex flex-col items-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="select-none">
        {/* Background circle (terrain-occluded outer region) */}
        <circle cx={CENTER} cy={CENTER} r={MAX_R} fill="#161f2e" stroke="#1e293b" strokeWidth="1" />

        {/* Unobstructed Sky Polygon (filled darker to represent open sky above local horizon) */}
        {horizonPolygon && (
          <polygon
            points={horizonPolygon}
            fill="#070a10"
            stroke="#64748b"
            strokeWidth="1.2"
          />
        )}

        {/* Elevation rings: +20°, +10°, 0° (Horizon) */}
        {[20, 10, 0].map((el) => (
          <circle
            key={el}
            cx={CENTER}
            cy={CENTER}
            r={elToRadius(el)}
            fill="none"
            stroke={el === 0 ? '#334155' : '#161e2e'}
            strokeWidth={el === 0 ? '1' : '0.75'}
            strokeDasharray={el === 0 ? undefined : '2 2'}
          />
        ))}

        {/* Cardinal crosshairs */}
        <line x1={CENTER} y1={CENTER - MAX_R} x2={CENTER} y2={CENTER + MAX_R} stroke="#161e2e" strokeWidth="0.75" />
        <line x1={CENTER - MAX_R} y1={CENTER} x2={CENTER + MAX_R} y2={CENTER} stroke="#161e2e" strokeWidth="0.75" />

        {/* Sun & Earth 29.5-day trajectories */}
        {sunPath && (
          <path d={sunPath} fill="none" stroke="#f5b041" strokeWidth="1" strokeOpacity="0.45" />
        )}
        {earthPath && (
          <path d={earthPath} fill="none" stroke="#93c5fd" strokeWidth="1.2" strokeOpacity="0.55" />
        )}

        {/* Live Sun & Earth Cursors */}
        {sunPt && (
          <g>
            <circle cx={sunPt[0]} cy={sunPt[1]} r={5} fill="#f5b041" fillOpacity="0.3" />
            <circle cx={sunPt[0]} cy={sunPt[1]} r={3} fill="#f5b041" />
          </g>
        )}
        {earthPt && (
          <g>
            <circle cx={earthPt[0]} cy={earthPt[1]} r={5} fill="#93c5fd" fillOpacity="0.3" />
            <circle cx={earthPt[0]} cy={earthPt[1]} r={3} fill="#93c5fd" />
          </g>
        )}

        {/* Cardinal labels */}
        <text x={CENTER} y={13} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="IBM Plex Mono">
          N 0°
        </text>
        <text x={SIZE - 8} y={CENTER + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="IBM Plex Mono">
          E
        </text>
        <text x={CENTER} y={SIZE - 5} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="IBM Plex Mono">
          S
        </text>
        <text x={8} y={CENTER + 3} textAnchor="start" fill="#64748b" fontSize="9" fontFamily="IBM Plex Mono">
          W
        </text>
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#f5b041]" /> Sun
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#93c5fd]" /> Earth
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 border border-slate-500 bg-slate-700/60" /> Sky Mask
        </span>
      </div>
    </div>
  );
}
