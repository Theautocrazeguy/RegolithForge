import { Html, Line } from '@react-three/drei';
import { useMemo } from 'react';
import {
  azElToVector,
  latLonToLocalPixel,
  localPixelToWorldMeters,
  trueAzToGridAz,
} from '../core/azEl';
import { evaluateDteStep } from '../core/dte';
import { sampleElevation } from '../core/slope';
import { AOI_DIM } from '../core/types';
import { useRegolithStore } from '../state/store';

const LUNAR_FEATURES = [
  { name: 'Shackleton Rim', lat: -89.9, lon: 0.0 },
  { name: 'South Pole (90°S)', lat: -90.0, lon: 0.0 },
  { name: 'Connecting Ridge', lat: -89.45, lon: 222.5 },
  { name: 'Shackleton Floor', lat: -89.68, lon: 130.0 },
];

export function LanderMarker() {
  const activeSite = useRegolithStore((s) => s.activeSite);
  const mastHeightM = useRegolithStore((s) => s.mastHeightM);
  const elev = useRegolithStore((s) => s.elev);
  const ephemeris = useRegolithStore((s) => s.ephemeris);
  const activeEphemerisKey = useRegolithStore((s) => s.activeEphemerisKey);
  const stepIndex = useRegolithStore((s) => s.stepIndex);
  const horizonMaskDeg = useRegolithStore((s) => s.horizonMaskDeg);
  const showLabels = useRegolithStore((s) => s.showLabels);
  const mode = useRegolithStore((s) => s.mode);
  const uncertaintyRadiusM = useRegolithStore((s) => s.uncertaintyRadiusM);

  const featurePositions = useMemo(() => {
    if (!elev) return [];
    return LUNAR_FEATURES.map((f) => {
      const { px, py } = latLonToLocalPixel(f.lat, f.lon);
      const { worldX, worldZ } = localPixelToWorldMeters(px, py);
      const y = sampleElevation(elev, AOI_DIM, AOI_DIM, px, py);
      return { ...f, worldX, worldZ, y };
    });
  }, [elev]);

  const earthLine = useMemo(() => {
    if (!activeSite || !ephemeris) return null;
    const step = ephemeris.sites[activeEphemerisKey]?.ephemeris[stepIndex];
    if (!step) return null;

    const dte = horizonMaskDeg ? evaluateDteStep(step, horizonMaskDeg) : null;
    const gridAz = trueAzToGridAz(step.earth.azimuth_deg, activeSite.lonDeg);
    const v = azElToVector(gridAz, step.earth.elevation_deg);
    const start: [number, number, number] = [
      activeSite.worldX,
      activeSite.elevM + mastHeightM + 8,
      activeSite.worldZ,
    ];
    const len = 14000;
    const end: [number, number, number] = [
      start[0] + v.x * len,
      start[1] + v.y * len,
      start[2] + v.z * len,
    ];

    return {
      points: [start, end] as [[number, number, number], [number, number, number]],
      visible: dte?.visible ?? true,
    };
  }, [activeSite, ephemeris, activeEphemerisKey, stepIndex, horizonMaskDeg, mastHeightM]);

  return (
    <group>
      {activeSite && (
        <group position={[activeSite.worldX, activeSite.elevM, activeSite.worldZ]}>
          {/* Lander Footpad Base */}
          <mesh position={[0, 12, 0]} castShadow>
            <cylinderGeometry args={[28, 42, 24, 6]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.35} />
          </mesh>

          {/* Mast Tower (scaled visually with true mastHeightM indicator) */}
          <mesh position={[0, 24 + Math.max(20, mastHeightM * 8) / 2, 0]}>
            <cylinderGeometry args={[4, 6, Math.max(20, mastHeightM * 8), 8]} />
            <meshStandardMaterial color="#f5b041" emissive="#f5b041" emissiveIntensity={0.4} />
          </mesh>

          {/* Landing Zone Ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
            <ringGeometry args={[85, 105, 32]} />
            <meshBasicMaterial color="#f5b041" transparent opacity={0.85} />
          </mesh>

          {/* Landing Uncertainty Dispersion Ellipse */}
          {uncertaintyRadiusM > 0 && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 6, 0]} scale={[1.25, 0.85, 1]}>
              <ringGeometry args={[uncertaintyRadiusM - 15, uncertaintyRadiusM, 64]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.75} />
            </mesh>
          )}

          {mode === 'planner' && (
            <Html position={[0, 140, 0]} center distanceFactor={8000} style={{ pointerEvents: 'none' }}>
              <div className="whitespace-nowrap rounded border border-[#f5b041]/60 bg-[#06080d]/90 px-2 py-0.5 text-[10px] font-mono-num text-[#f5b041] shadow">
                {activeSite.name ? activeSite.name : 'LANDER'} · {activeSite.elevM.toFixed(0)}m
              </div>
            </Html>
          )}
        </group>
      )}

      {/* Earth Direct-to-Earth (DTE) Line-of-Sight Vector */}
      {earthLine && (
        <Line
          points={earthLine.points}
          color={earthLine.visible ? '#93c5fd' : '#ef4444'}
          lineWidth={1.5}
          dashed={!earthLine.visible}
          dashSize={300}
          gapSize={200}
          transparent
          opacity={earthLine.visible ? 0.7 : 0.45}
        />
      )}

      {/* Real Lunar Feature Labels */}
      {showLabels &&
        mode === 'planner' &&
        featurePositions.map((f) => (
          <Html
            key={f.name}
            position={[f.worldX, f.y + 600, f.worldZ]}
            center
            distanceFactor={12000}
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded border border-slate-700/70 bg-[#06080d]/75 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-300">
              {f.name}
            </div>
          </Html>
        ))}
    </group>
  );
}
