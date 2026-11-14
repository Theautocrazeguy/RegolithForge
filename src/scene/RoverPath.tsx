import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { localPixelToWorldMeters } from '../core/azEl';
import { sampleElevation } from '../core/slope';
import { AOI_DIM } from '../core/types';
import { useRegolithStore } from '../state/store';

export function RoverPath() {
  const elev = useRegolithStore((s) => s.elev);
  const traverseResult = useRegolithStore((s) => s.traverseResult);
  const traverseGoal = useRegolithStore((s) => s.traverseGoal);
  const roverRef = useRef<THREE.Group | null>(null);
  const progressRef = useRef(0);

  const worldPoints = useMemo(() => {
    if (!elev || !traverseResult || !traverseResult.found || traverseResult.path.length < 2) {
      return [];
    }
    return traverseResult.path.map((pt) => {
      const { worldX, worldZ } = localPixelToWorldMeters(pt.px, pt.py);
      const y = sampleElevation(elev, AOI_DIM, AOI_DIM, pt.px, pt.py) + 12;
      return [worldX, y, worldZ] as [number, number, number];
    });
  }, [elev, traverseResult]);

  const goalWorld = useMemo(() => {
    if (!elev || !traverseGoal) return null;
    const { worldX, worldZ } = localPixelToWorldMeters(traverseGoal.px, traverseGoal.py);
    const y = sampleElevation(elev, AOI_DIM, AOI_DIM, traverseGoal.px, traverseGoal.py);
    return [worldX, y, worldZ] as [number, number, number];
  }, [elev, traverseGoal]);

  useFrame((_, delta) => {
    if (!roverRef.current || worldPoints.length < 2) return;
    progressRef.current = (progressRef.current + delta * 0.12) % 1;
    const totalSegs = worldPoints.length - 1;
    const exactIdx = progressRef.current * totalSegs;
    const i0 = Math.floor(exactIdx);
    const i1 = Math.min(totalSegs, i0 + 1);
    const t = exactIdx - i0;

    const p0 = worldPoints[i0];
    const p1 = worldPoints[i1];
    roverRef.current.position.set(
      p0[0] + (p1[0] - p0[0]) * t,
      p0[1] + (p1[1] - p0[1]) * t + 6,
      p0[2] + (p1[2] - p0[2]) * t
    );
  });

  return (
    <group>
      {worldPoints.length >= 2 && (
        <>
          <Line points={worldPoints} color="#22d3ee" lineWidth={2.5} />
          {/* Animated 3D Rover */}
          <group ref={roverRef}>
            <mesh castShadow>
              <boxGeometry args={[36, 20, 48]} />
              <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.4} />
            </mesh>
          </group>
        </>
      )}

      {goalWorld && (
        <group position={goalWorld}>
          <mesh position={[0, 35, 0]}>
            <coneGeometry args={[28, 70, 8]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.35} />
          </mesh>
        </group>
      )}
    </group>
  );
}
