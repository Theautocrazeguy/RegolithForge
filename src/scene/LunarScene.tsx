import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { R_MOON_M } from '../core/types';
import { useRegolithStore } from '../state/store';
import { LanderMarker } from './LanderMarker';
import { Lighting } from './Lighting';
import { LunarGlobe } from './LunarGlobe';
import { RoverPath } from './RoverPath';
import { SkyDome } from './SkyDome';
import { TerrainMesh } from './TerrainMesh';

function CameraController() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();
  const mode = useRegolithStore((s) => s.mode);
  const cameraView = useRegolithStore((s) => s.cameraView);
  const activeSite = useRegolithStore((s) => s.activeSite);

  useEffect(() => {
    if (!controlsRef.current) return;
    if (mode === 'explorer' && activeSite) {
      camera.position.set(activeSite.worldX, activeSite.elevM + 2.5, activeSite.worldZ + 1);
      controlsRef.current.target.set(
        activeSite.worldX + 200,
        activeSite.elevM + 4.0,
        activeSite.worldZ - 200
      );
      controlsRef.current.maxDistance = 120;
      controlsRef.current.minDistance = 0.5;
    } else if (cameraView === 'globe') {
      // Frame the entire 3,474.8 km Moon sphere with the South Pole & beacon well inside the viewport
      camera.position.set(0, -R_MOON_M + 4_200_000, -2_200_000);
      controlsRef.current.target.set(0, -R_MOON_M + 250_000, 0);
      controlsRef.current.maxDistance = 8_000_000;
      controlsRef.current.minDistance = 150;
    } else if (activeSite) {
      camera.position.set(
        activeSite.worldX + 4500,
        activeSite.elevM + 5500,
        activeSite.worldZ + 6500
      );
      controlsRef.current.target.set(activeSite.worldX, activeSite.elevM, activeSite.worldZ);
      controlsRef.current.maxDistance = 8_000_000;
      controlsRef.current.minDistance = 150;
    }
    controlsRef.current.update();
  }, [mode, cameraView, activeSite?.name, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={mode === 'explorer' ? Math.PI * 0.58 : cameraView === 'globe' ? Math.PI : Math.PI * 0.49}
      minDistance={mode === 'explorer' ? 0.5 : 150}
      maxDistance={mode === 'explorer' ? 120 : 8_000_000}
    />
  );
}

export function LunarScene() {
  return (
    <div className="h-full w-full bg-[#020306]">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        camera={{ fov: 45, near: 1, far: 35_000_000, position: [3000, 7500, 9500] }}
      >
        <SkyDome />
        <Lighting />
        <LunarGlobe />
        <TerrainMesh />
        <LanderMarker />
        <RoverPath />
        <CameraController />
      </Canvas>
    </div>
  );
}
