import { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { worldMetersToLocalPixel } from '../core/azEl';
import { sampleElevation } from '../core/slope';
import { AOI_DIM, LOLA_MAP_SCALE_M } from '../core/types';
import { useRegolithStore } from '../state/store';

const TERRAIN_SPAN_M = AOI_DIM * LOLA_MAP_SCALE_M; // 20,480 m
const MESH_SEGMENTS = 256; // 256x256 grid = ~131k triangles for smooth 60fps

export function TerrainMesh() {
  const elev = useRegolithStore((s) => s.elev);
  const slopeGrid = useRegolithStore((s) => s.slopeGrid);
  const illumGrid = useRegolithStore((s) => s.illumGrid);
  const psrGrid = useRegolithStore((s) => s.psrGrid);

  const showSlopeHazard = useRegolithStore((s) => s.showSlopeHazard);
  const showPelOverlay = useRegolithStore((s) => s.showPelOverlay);
  const showPsrOverlay = useRegolithStore((s) => s.showPsrOverlay);
  const showThermalOverlay = useRegolithStore((s) => s.showThermalOverlay);
  const criticalSlopeDeg = useRegolithStore((s) => s.criticalSlopeDeg);
  const colorBlindSafe = useRegolithStore((s) => s.colorBlindSafe);
  const selectSiteByPixel = useRegolithStore((s) => s.selectSiteByPixel);
  const pickingTraverseGoal = useRegolithStore((s) => s.pickingTraverseGoal);
  const runTraverseToGoal = useRegolithStore((s) => s.runTraverseToGoal);

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Build displaced terrain geometry from real 1024x1024 Float32 DEM
  const geometry = useMemo(() => {
    if (!elev) return null;
    const geom = new THREE.PlaneGeometry(
      TERRAIN_SPAN_M,
      TERRAIN_SPAN_M,
      MESH_SEGMENTS,
      MESH_SEGMENTS
    );
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      const { px, py } = worldMetersToLocalPixel(wx, wz);
      const yElev = sampleElevation(elev, AOI_DIM, AOI_DIM, px, py);
      pos.setY(i, yElev);
    }

    geom.computeVertexNormals();
    return geom;
  }, [elev]);

  // Build GPU DataTextures for slope, illumination, and PSR overlays
  const textures = useMemo(() => {
    if (!slopeGrid || !illumGrid || !psrGrid) return null;

    const makeTex = (data: Uint8Array) => {
      const tex = new THREE.DataTexture(data, AOI_DIM, AOI_DIM, THREE.RedFormat, THREE.UnsignedByteType);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.flipY = false;
      tex.needsUpdate = true;
      return tex;
    };

    const illumU8 = new Uint8Array(illumGrid.length);
    for (let i = 0; i < illumGrid.length; i++) {
      illumU8[i] = Math.round(illumGrid[i] * 255);
    }

    return {
      slopeTex: makeTex(slopeGrid),
      illumTex: makeTex(illumU8),
      psrTex: makeTex(psrGrid),
    };
  }, [slopeGrid, illumGrid, psrGrid]);

  // Uniforms shared with onBeforeCompile shader
  const uniformsRef = useRef({
    uSlopeTex: { value: null as THREE.DataTexture | null },
    uIllumTex: { value: null as THREE.DataTexture | null },
    uPsrTex: { value: null as THREE.DataTexture | null },
    uShowSlope: { value: 0.0 },
    uShowPel: { value: 0.0 },
    uShowPsr: { value: 0.0 },
    uShowThermal: { value: 0.0 },
    uSlopeThreshold: { value: 15.0 },
    uColorBlind: { value: 0.0 },
  });

  useEffect(() => {
    if (!textures) return;
    uniformsRef.current.uSlopeTex.value = textures.slopeTex;
    uniformsRef.current.uIllumTex.value = textures.illumTex;
    uniformsRef.current.uPsrTex.value = textures.psrTex;
  }, [textures]);

  useEffect(() => {
    uniformsRef.current.uShowSlope.value = showSlopeHazard ? 1.0 : 0.0;
    uniformsRef.current.uShowPel.value = showPelOverlay ? 1.0 : 0.0;
    uniformsRef.current.uShowPsr.value = showPsrOverlay ? 1.0 : 0.0;
    uniformsRef.current.uShowThermal.value = showThermalOverlay ? 1.0 : 0.0;
    uniformsRef.current.uSlopeThreshold.value = criticalSlopeDeg;
    uniformsRef.current.uColorBlind.value = colorBlindSafe ? 1.0 : 0.0;
  }, [showSlopeHazard, showPelOverlay, showPsrOverlay, showThermalOverlay, criticalSlopeDeg, colorBlindSafe]);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7a7d82'),
      roughness: 0.96,
      metalness: 0.02,
      flatShading: false,
    });

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniformsRef.current);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vTerrainUv;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vTerrainUv = (position.xz + ${TERRAIN_SPAN_M.toFixed(1)} * 0.5) / ${TERRAIN_SPAN_M.toFixed(1)};`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vTerrainUv;
          uniform sampler2D uSlopeTex;
          uniform sampler2D uIllumTex;
          uniform sampler2D uPsrTex;
          uniform float uShowSlope;
          uniform float uShowPel;
          uniform float uShowPsr;
          uniform float uShowThermal;
          uniform float uSlopeThreshold;
          uniform float uColorBlind;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if (uShowThermal > 0.5) {
            float illumT = texture2D(uIllumTex, vTerrainUv).r;
            vec3 coldCol = vec3(0.18, 0.16, 0.52);
            vec3 midCol = vec3(0.55, 0.25, 0.45);
            vec3 warmCol = vec3(0.95, 0.48, 0.18);
            vec3 thermCol = illumT < 0.25 ? mix(coldCol, midCol, illumT * 4.0) : mix(midCol, warmCol, (illumT - 0.25) / 0.75);
            diffuseColor.rgb = mix(diffuseColor.rgb, thermCol, 0.58);
          }
          if (uShowSlope > 0.5) {
            float slopeDeg = texture2D(uSlopeTex, vTerrainUv).r * 45.0;
            vec3 safeCol = uColorBlind > 0.5 ? vec3(0.0, 0.45, 0.7) : vec3(0.12, 0.55, 0.35);
            vec3 warnCol = vec3(0.92, 0.65, 0.15);
            vec3 hazCol = uColorBlind > 0.5 ? vec3(0.84, 0.37, 0.0) : vec3(0.94, 0.27, 0.27);
            float t = clamp(slopeDeg / max(1.0, uSlopeThreshold), 0.0, 1.5);
            vec3 slopeTint = t >= 1.0 ? hazCol : mix(safeCol, warnCol, smoothstep(0.5, 0.99, t));
            float alpha = t >= 1.0 ? 0.68 : 0.32;
            diffuseColor.rgb = mix(diffuseColor.rgb, slopeTint, alpha);
          }
          if (uShowPel > 0.5) {
            float illum = texture2D(uIllumTex, vTerrainUv).r;
            if (illum > 0.60) {
              vec3 goldCol = vec3(0.96, 0.69, 0.25);
              diffuseColor.rgb = mix(diffuseColor.rgb, goldCol, smoothstep(0.60, 0.95, illum) * 0.78);
            }
          }
          if (uShowPsr > 0.5) {
            float psr = texture2D(uPsrTex, vTerrainUv).r;
            if (psr > 0.5) {
              vec3 cyanCol = uColorBlind > 0.5 ? vec3(0.35, 0.70, 0.90) : vec3(0.13, 0.83, 0.93);
              diffuseColor.rgb = mix(diffuseColor.rgb, cyanCol, 0.72);
            }
          }`
        );
    };

    return mat;
  }, []);

  // Dispose geometry, material, and GPU textures on unmount
  useEffect(() => {
    return () => {
      geometry?.dispose();
      material.dispose();
      textures?.slopeTex.dispose();
      textures?.illumTex.dispose();
      textures?.psrTex.dispose();
    };
  }, [geometry, material, textures]);

  if (!geometry) return null;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!pointerDownPos.current) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    pointerDownPos.current = null;
    if (Math.hypot(dx, dy) > 5) return; // Ignore orbit/pan drags
    e.stopPropagation();
    const { px, py } = worldMetersToLocalPixel(e.point.x, e.point.z);
    if (pickingTraverseGoal) {
      runTraverseToGoal({ px: Math.round(px), py: Math.round(py) });
    } else {
      selectSiteByPixel(px, py);
    }
  };

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    />
  );
}
