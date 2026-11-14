import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { azElToVector, trueAzToGridAz } from '../core/azEl';
import { useRegolithStore } from '../state/store';

const SKY_RADIUS_M = 12_000_000;

export function SkyDome() {
  const ephemeris = useRegolithStore((s) => s.ephemeris);
  const activeEphemerisKey = useRegolithStore((s) => s.activeEphemerisKey);
  const stepIndex = useRegolithStore((s) => s.stepIndex);
  const activeSite = useRegolithStore((s) => s.activeSite);

  // Deterministic starfield sphere
  const starGeo = useMemo(() => {
    const count = 2400;
    const positions = new Float32Array(count * 3);
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const u = rand();
      const v = rand();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = SKY_RADIUS_M * 1.15;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  useEffect(() => {
    return () => {
      starGeo.dispose();
    };
  }, [starGeo]);

  const { sunPos, earthPos } = useMemo(() => {
    const steps = ephemeris?.sites[activeEphemerisKey]?.ephemeris;
    const step = steps?.[stepIndex];
    if (!step) {
      return {
        sunPos: [30000, 1500, -30000] as [number, number, number],
        earthPos: [20000, 5000, 20000] as [number, number, number],
      };
    }

    const siteLon = activeSite?.lonDeg ?? ephemeris?.sites[activeEphemerisKey]?.lon ?? 222.5;
    const sunVec = azElToVector(
      trueAzToGridAz(step.sun.azimuth_deg, siteLon),
      step.sun.elevation_deg
    );
    const earthVec = azElToVector(
      trueAzToGridAz(step.earth.azimuth_deg, siteLon),
      step.earth.elevation_deg
    );

    return {
      sunPos: [sunVec.x * SKY_RADIUS_M, sunVec.y * SKY_RADIUS_M, sunVec.z * SKY_RADIUS_M] as [
        number,
        number,
        number,
      ],
      earthPos: [
        earthVec.x * SKY_RADIUS_M,
        earthVec.y * SKY_RADIUS_M,
        earthVec.z * SKY_RADIUS_M,
      ] as [number, number, number],
    };
  }, [ephemeris, activeEphemerisKey, stepIndex, activeSite?.lonDeg]);

  // True angular sizes at SKY_RADIUS_M:
  // Sun diameter 0.533° -> radius = R * tan(0.2665°)
  const sunRadiusM = SKY_RADIUS_M * Math.tan((0.2665 * Math.PI) / 180);
  // Earth diameter ~1.90° -> radius = R * tan(0.95°)
  const earthRadiusM = SKY_RADIUS_M * Math.tan((0.95 * Math.PI) / 180);

  return (
    <group>
      <color attach="background" args={['#020306']} />
      <points geometry={starGeo}>
        <pointsMaterial size={1.8} color="#e2e8f0" sizeAttenuation={false} transparent opacity={0.85} />
      </points>

      {/* Sun Disc (0.533° true angular size) */}
      <mesh position={sunPos}>
        <sphereGeometry args={[sunRadiusM, 24, 24]} />
        <meshBasicMaterial color="#fff8d6" />
      </mesh>

      {/* Earth Disc (1.90° true angular size) */}
      <mesh position={earthPos}>
        <sphereGeometry args={[earthRadiusM, 24, 24]} />
        <meshBasicMaterial color="#7dd3fc" />
      </mesh>
    </group>
  );
}
