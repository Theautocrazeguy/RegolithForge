import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  azElToVector,
  latLonToLocalPixel,
  localPixelToWorldMeters,
  trueAzToGridAz,
} from '../core/azEl';
import { AOI_DIM, LOLA_MAP_SCALE_M, R_MOON_M } from '../core/types';
import { useRegolithStore } from '../state/store';

const HALF_TILE_M = (AOI_DIM * LOLA_MAP_SCALE_M) / 2; // 10,240 m

// Exact world-space position of the true South Pole (-90°, 0°) relative to the AOI center
const POLE_PX = latLonToLocalPixel(-90, 0);
const POLE_WORLD = localPixelToWorldMeters(POLE_PX.px, POLE_PX.py);

/**
 * Full 3D Lunar Globe (R = 1,737,400 m) using real NASA LRO/LROC WAC global albedo
 * and LOLA global elevation normal map (ldem_4) mapped in exact selenographic coordinates
 * (-Z = 0 deg Prime Meridian, +X = +90 deg E, +Y = -90 deg South Pole).
 */
export function LunarGlobe() {
  const ephemeris = useRegolithStore((s) => s.ephemeris);
  const activeEphemerisKey = useRegolithStore((s) => s.activeEphemerisKey);
  const stepIndex = useRegolithStore((s) => s.stepIndex);
  const activeSite = useRegolithStore((s) => s.activeSite);
  const cameraView = useRegolithStore((s) => s.cameraView);

  const sunDir = useMemo(() => {
    const steps = ephemeris?.sites[activeEphemerisKey]?.ephemeris;
    const step = steps?.[stepIndex];
    if (!step) return new THREE.Vector3(0.7, 0.05, -0.7).normalize();
    const siteLon = activeSite?.lonDeg ?? ephemeris?.sites[activeEphemerisKey]?.lon ?? 222.5;
    const v = azElToVector(trueAzToGridAz(step.sun.azimuth_deg, siteLon), step.sun.elevation_deg);
    return new THREE.Vector3(v.x, v.y, v.z).normalize();
  }, [ephemeris, activeEphemerisKey, stepIndex, activeSite?.lonDeg]);

  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();

    const albedo = loader.load('/data/moon_global_albedo.jpg');
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = THREE.RepeatWrapping;
    albedo.wrapT = THREE.ClampToEdgeWrapping;
    albedo.minFilter = THREE.LinearFilter;
    albedo.magFilter = THREE.LinearFilter;
    albedo.generateMipmaps = false;

    const normal = loader.load('/data/moon_global_normal.png');
    normal.wrapS = THREE.RepeatWrapping;
    normal.wrapT = THREE.ClampToEdgeWrapping;
    normal.minFilter = THREE.LinearFilter;
    normal.magFilter = THREE.LinearFilter;
    normal.generateMipmaps = false;

    return { albedo, normal };
  }, []);

  useEffect(() => {
    return () => {
      textures.albedo.dispose();
      textures.normal.dispose();
    };
  }, [textures]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.7, 0.05, -0.7).normalize() },
        uAlbedoMap: { value: textures.albedo },
        uNormalMap: { value: textures.normal },
        uHalfTile: { value: HALF_TILE_M },
        uMoonRadius: { value: R_MOON_M },
      },
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vLocalDir;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;

        void main() {
          vLocalDir = normalize(position);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uSunDir;
        uniform sampler2D uAlbedoMap;
        uniform sampler2D uNormalMap;
        uniform float uHalfTile;
        uniform float uMoonRadius;

        varying vec3 vLocalDir;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;

        void main() {
          // Cut out the 20.48 km x 20.48 km REAL LOLA South Pole patch
          if (
            abs(vWorldPos.x) < uHalfTile &&
            abs(vWorldPos.z) < uHalfTile &&
            vWorldPos.y > -uMoonRadius * 0.5
          ) {
            discard;
          }

          vec3 d = normalize(vLocalDir);

          // Exact selenographic equirectangular coordinates:
          // +Y = South Pole (-90 deg), -Y = North Pole (+90 deg)
          // -Z = 0 deg Prime Meridian, +X = +90 deg E
          float lat = -asin(clamp(d.y, -1.0, 1.0));
          float lon = atan(d.x, -d.z);
          float u = fract(lon / (2.0 * PI) + 0.5);
          float v = clamp(lat / PI + 0.5, 0.0005, 0.9995);
          vec2 uv = vec2(u, v);

          // Sample real NASA LROC WAC albedo & LOLA elevation normal map
          vec3 albedo = texture2D(uAlbedoMap, uv).rgb;
          vec3 nMap = texture2D(uNormalMap, uv).xyz * 2.0 - 1.0;

          // Orthonormal spherical tangent basis (east, north, surface normal)
          vec3 poleAxis = vec3(0.0, -1.0, 0.0);
          vec3 east = abs(d.y) < 0.9998 ? normalize(cross(poleAxis, d)) : vec3(1.0, 0.0, 0.0);
          vec3 north = normalize(cross(d, east));
          vec3 perturbedNormal = normalize(east * nMap.x + north * nMap.y + vWorldNormal * nMap.z);

          // Physically-inspired lunar Hapke/Lommel-Seeliger + Lambert terminator + subtle Earthshine
          vec3 sun = normalize(uSunDir);
          float ndotl = max(dot(perturbedNormal, sun), 0.0);
          float macroNdotl = smoothstep(-0.04, 0.06, dot(vWorldNormal, sun));
          float lit = pow(ndotl, 0.85) * macroNdotl;
          vec3 col = albedo * (0.028 + 1.22 * lit);

          gl_FragColor = vec4(col, 1.0);
          #include <logdepthbuf_fragment>
        }
      `,
    });
  }, [textures]);

  useEffect(() => {
    shaderMaterial.uniforms.uSunDir.value.copy(sunDir);
  }, [sunDir, shaderMaterial]);

  useEffect(() => {
    return () => {
      shaderMaterial.dispose();
    };
  }, [shaderMaterial]);

  // Crisp survey-zone perimeter frame around the 20.48 km x 20.48 km LOLA tile
  const borderLine = useMemo(() => {
    const h = HALF_TILE_M;
    const y = 50;
    const pts = [
      new THREE.Vector3(-h, y, -h),
      new THREE.Vector3(h, y, -h),
      new THREE.Vector3(h, y, h),
      new THREE.Vector3(-h, y, h),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: '#f5b041', transparent: true, opacity: 0.45 });
    return new THREE.LineLoop(geo, mat);
  }, []);

  useEffect(() => {
    return () => {
      borderLine.geometry.dispose();
      (borderLine.material as THREE.Material).dispose();
    };
  }, [borderLine]);

  return (
    <group>
      <mesh position={[POLE_WORLD.worldX, -R_MOON_M, POLE_WORLD.worldZ]} material={shaderMaterial}>
        <sphereGeometry args={[R_MOON_M, 128, 96]} />
      </mesh>
      <primitive object={borderLine} />
      {cameraView === 'globe' && activeSite && (
        <group position={[activeSite.worldX, activeSite.elevM + 2000, activeSite.worldZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[32000, 44000, 48]} />
            <meshBasicMaterial color="#f5b041" side={THREE.DoubleSide} />
          </mesh>
          <Html center distanceFactor={3_500_000} style={{ pointerEvents: 'none' }}>
            <div className="whitespace-nowrap rounded border border-[#f5b041]/70 bg-[#06080d]/90 px-2 py-0.5 font-mono-num text-[10px] text-[#f5b041] shadow">
              {activeSite.name ?? 'LANDING SITE'} · {activeSite.latDeg.toFixed(2)}°,{' '}
              {activeSite.lonDeg.toFixed(1)}°E
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
