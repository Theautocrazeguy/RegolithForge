import { useMemo } from 'react';
import { azElToVector, trueAzToGridAz } from '../core/azEl';
import { useRegolithStore } from '../state/store';

export function Lighting() {
  const ephemeris = useRegolithStore((s) => s.ephemeris);
  const activeEphemerisKey = useRegolithStore((s) => s.activeEphemerisKey);
  const stepIndex = useRegolithStore((s) => s.stepIndex);
  const activeSite = useRegolithStore((s) => s.activeSite);

  const sunPos = useMemo(() => {
    const steps = ephemeris?.sites[activeEphemerisKey]?.ephemeris;
    const step = steps?.[stepIndex];
    if (!step) return [15000, 1000, -15000] as [number, number, number];

    const siteLon = activeSite?.lonDeg ?? ephemeris?.sites[activeEphemerisKey]?.lon ?? 222.5;
    const gridAz = trueAzToGridAz(step.sun.azimuth_deg, siteLon);
    const v = azElToVector(gridAz, step.sun.elevation_deg);
    const dist = 28000;
    return [v.x * dist, v.y * dist, v.z * dist] as [number, number, number];
  }, [ephemeris, activeEphemerisKey, stepIndex, activeSite?.lonDeg]);

  return (
    <>
      {/* Very low ambient light (~0.04) for authentic airless lunar shadow contrast */}
      <ambientLight intensity={0.04} color="#cbd5e1" />
      <directionalLight
        position={sunPos}
        intensity={3.2}
        color="#fffcf2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1000}
        shadow-camera-far={65000}
        shadow-camera-left={-13000}
        shadow-camera-right={13000}
        shadow-camera-top={13000}
        shadow-camera-bottom={-13000}
        shadow-bias={-0.0005}
        shadow-normalBias={18}
      />
    </>
  );
}
