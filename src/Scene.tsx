import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Sky } from "@react-three/drei";
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";

// Material color + property overrides for the GLB model.
// Many materials exported as white (1,1,1) because Blender textures didn't transfer.
const MATERIAL_FIXES: Record<
  string,
  { color?: string; roughness?: number; metalness?: number; envMapIntensity?: number }
> = {
  // Surfaces
  Concrete: { color: "#b8b4ac", roughness: 0.92 },
  Hardstand: { color: "#a09a90", roughness: 0.95 },
  Tarmac: { color: "#2a2a2a", roughness: 0.88 },
  Road: { color: "#3a3a38", roughness: 0.85 },
  ParkLine: { color: "#e8e4d8", roughness: 0.6 },

  // Buildings
  Brick: { color: "#8b7355", roughness: 0.85 },
  Roof: { color: "#5a6670", roughness: 0.6, metalness: 0.3 },

  // Landscape
  Grass: { color: "#4a7a3a", roughness: 0.95 },

  // Marina
  Pontoon: { color: "#8b7255", roughness: 0.75 },
  "Pontoon.001": { color: "#8b7255", roughness: 0.75 },
  "Pontoon.002": { color: "#8b7255", roughness: 0.75 },
  "Pontoon.003": { color: "#8b7255", roughness: 0.75 },
  "Pontoon.004": { color: "#8b7255", roughness: 0.75 },
  "Pontoon.005": { color: "#8b7255", roughness: 0.75 },
  "Pontoon.006": { color: "#8b7255", roughness: 0.75 },
  "Pontoon.007": { color: "#8b7255", roughness: 0.75 },
  "Pontoon.008": { color: "#8b7255", roughness: 0.75 },
  Pile: { color: "#6b6b68", roughness: 0.45, metalness: 0.75 },
  Dolphin: { color: "#7a7a78", roughness: 0.65, metalness: 0.4 },

  // Structures
  Gate: { color: "#404248", roughness: 0.5, metalness: 0.65 },
  Cradle: { color: "#2a4570", roughness: 0.5, metalness: 0.6 },
  Hoist: { color: "#d4a810", roughness: 0.35, metalness: 0.55 },
  HoistStl: { color: "#606060", roughness: 0.3, metalness: 0.85 },
  Green: { color: "#2d6b3f", roughness: 0.5, metalness: 0.3 },

  // Vessels
  HullB: { color: "#0a1840", roughness: 0.08, envMapIntensity: 1.5 },
  HullD: { color: "#040a1e", roughness: 0.08, envMapIntensity: 1.5 },
  HullW: { color: "#f0f0ec", roughness: 0.08, envMapIntensity: 1.2 },
  Super: { color: "#f5f5f3", roughness: 0.06, envMapIntensity: 1.5 },
  Glass: { color: "#6080a0", roughness: 0.01, metalness: 0.1, envMapIntensity: 2.0 },
  Deck: { color: "#c4a060", roughness: 0.7 },

  // Cars
  CarBlk: { color: "#050505", roughness: 0.15, envMapIntensity: 1.5 },
  CarBlu: { color: "#0c2860", roughness: 0.2, envMapIntensity: 1.2 },
  CarRed: { color: "#8c1408", roughness: 0.2, envMapIntensity: 1.2 },
  CarSlv: { color: "#a5a5a0", roughness: 0.15, metalness: 0.55, envMapIntensity: 1.5 },
  CarWht: { color: "#e8e8e5", roughness: 0.15, envMapIntensity: 1.2 },
};

// Model is ~2000x2000 in XZ, ~40 tall after centering at origin
const CAMERA_POINTS = [
  { pos: [1400, 1000, 1400], target: [0, 0, 0] },
  { pos: [-800, 500, 1000], target: [100, 0, -100] },
  { pos: [1000, 500, -700], target: [0, 0, 100] },
  { pos: [-400, 150, -300], target: [-600, 0, -500] },
  { pos: [400, 200, -600], target: [200, 20, -300] },
  { pos: [900, 120, 500], target: [0, 30, 0] },
] as const;

function buildFlyPath() {
  const points = [
    new THREE.Vector3(1800, 1200, 1800),
    new THREE.Vector3(1000, 800, 1000),
    new THREE.Vector3(-400, 500, 800),
    new THREE.Vector3(-700, 250, -100),
    new THREE.Vector3(-400, 180, -500),
    new THREE.Vector3(200, 150, -600),
    new THREE.Vector3(700, 200, -400),
    new THREE.Vector3(1000, 400, 300),
    new THREE.Vector3(1400, 700, 900),
    new THREE.Vector3(1800, 1200, 1800),
  ];
  return new THREE.CatmullRomCurve3(points, true, "centripetal", 0.5);
}

interface SceneProps {
  flying: boolean;
  setFlying: (f: boolean) => void;
  cameraIndex: number;
  setCameraIndex: (i: number) => void;
}

export function Scene({ flying, cameraIndex }: SceneProps) {
  const { scene } = useGLTF("/tipner.glb");
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  const flyProgress = useRef(0);
  const flyCurve = useMemo(() => buildFlyPath(), []);
  const waterRef = useRef<Water>(null);

  const animating = useRef(false);
  const animStart = useRef({
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
  });
  const animEnd = useRef({
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
  });
  const animT = useRef(0);

  // Build environment cube map for reflections
  const pmremGenerator = useMemo(() => new THREE.PMREMGenerator(gl), [gl]);

  // Fix materials and extract water mesh
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  useEffect(() => {
    // Generate an environment map from a simple gradient for reflections
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(100, 32, 32);
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float t = dir.y * 0.5 + 0.5;
          vec3 skyTop = vec3(0.35, 0.55, 0.85);
          vec3 skyBot = vec3(0.7, 0.8, 0.9);
          vec3 ground = vec3(0.4, 0.38, 0.35);
          vec3 col = t > 0.5 ? mix(skyBot, skyTop, (t - 0.5) * 2.0) : mix(ground, skyBot, t * 2.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    const envMap = pmremGenerator.fromScene(envScene, 0, 0.1, 200).texture;

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.name) return;

      // Hide the water mesh from the GLB; we'll replace it
      if (mat.name === "Water") {
        child.visible = false;
        waterMeshRef.current = child;
        return;
      }

      const fix = MATERIAL_FIXES[mat.name];
      if (fix) {
        if (fix.color) mat.color.set(fix.color);
        if (fix.roughness !== undefined) mat.roughness = fix.roughness;
        if (fix.metalness !== undefined) mat.metalness = fix.metalness;
        mat.envMap = envMap;
        mat.envMapIntensity = fix.envMapIntensity ?? 0.6;
        mat.needsUpdate = true;
      } else {
        // Default: give everything an env map for subtle reflections
        mat.envMap = envMap;
        mat.envMapIntensity = 0.4;
        mat.needsUpdate = true;
      }
    });

    return () => {
      pmremGenerator.dispose();
      envMap.dispose();
    };
  }, [scene, pmremGenerator]);

  // Center the model
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
  }, [scene]);

  // Camera preset animation
  useEffect(() => {
    if (flying) return;
    const cp = CAMERA_POINTS[cameraIndex];
    animStart.current.pos.copy(camera.position);
    if (controlsRef.current) {
      animStart.current.target.copy(controlsRef.current.target);
    }
    animEnd.current.pos.set(cp.pos[0], cp.pos[1], cp.pos[2]);
    animEnd.current.target.set(cp.target[0], cp.target[1], cp.target[2]);
    animT.current = 0;
    animating.current = true;
  }, [cameraIndex, flying]);

  useFrame((_, delta) => {
    // Animate water
    if (waterRef.current) {
      waterRef.current.material.uniforms["time"].value += delta * 0.3;
    }

    if (flying) {
      flyProgress.current += delta * 0.012;
      if (flyProgress.current > 1) flyProgress.current -= 1;
      const point = flyCurve.getPointAt(flyProgress.current);
      camera.position.copy(point);
      const lookAt = flyCurve.getPointAt((flyProgress.current + 0.015) % 1);
      lookAt.y -= 150;
      camera.lookAt(lookAt);
      if (controlsRef.current) {
        controlsRef.current.target.copy(lookAt);
      }
      return;
    }

    if (animating.current) {
      animT.current = Math.min(1, animT.current + delta * 1.5);
      const t = easeInOutCubic(animT.current);
      camera.position.lerpVectors(
        animStart.current.pos,
        animEnd.current.pos,
        t
      );
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(
          animStart.current.target,
          animEnd.current.target,
          t
        );
      }
      if (animT.current >= 1) animating.current = false;
    }
  });

  // Create water geometry matching the original water mesh bounds
  const sunDirection = useMemo(
    () => new THREE.Vector3(0.5, 0.6, 0.3).normalize(),
    []
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.35} color="#e8e4f0" />
      <directionalLight
        position={[800, 1500, 600]}
        intensity={1.4}
        color="#fff5e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={4000}
        shadow-camera-left={-1500}
        shadow-camera-right={1500}
        shadow-camera-top={1500}
        shadow-camera-bottom={-1500}
      />
      <directionalLight
        position={[-600, 800, -400]}
        intensity={0.3}
        color="#c0d0f0"
      />
      <hemisphereLight
        args={["#87CEEB", "#8a7a60", 0.3]}
      />

      {/* Realistic sky with sun */}
      <Sky
        distance={50000}
        sunPosition={[800, 600, 300]}
        inclination={0.52}
        azimuth={0.25}
        rayleigh={1.5}
        turbidity={8}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={["#c8d8e8", 2000, 7000]} />

      {/* Model */}
      <primitive object={scene} />

      {/* Animated water */}
      <WaterPlane waterRef={waterRef} sunDirection={sunDirection} />

      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={50}
        maxDistance={3000}
        enabled={!flying}
      />
    </>
  );
}

function WaterPlane({
  waterRef,
  sunDirection,
}: {
  waterRef: React.RefObject<Water | null>;
  sunDirection: THREE.Vector3;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;
    const geometry = new THREE.PlaneGeometry(6000, 6000, 128, 128);

    // Generate a procedural normal map for wave detail
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const fx = x / size;
        const fy = y / size;
        const nx =
          Math.sin(fx * Math.PI * 8) * 0.3 +
          Math.sin(fx * Math.PI * 16 + fy * Math.PI * 4) * 0.15 +
          Math.sin((fx + fy) * Math.PI * 12) * 0.1;
        const ny =
          Math.sin(fy * Math.PI * 6) * 0.3 +
          Math.cos(fy * Math.PI * 14 + fx * Math.PI * 6) * 0.15 +
          Math.sin((fx - fy) * Math.PI * 10) * 0.1;
        data[i] = ((nx + 1) * 0.5 * 255) | 0;
        data[i + 1] = ((ny + 1) * 0.5 * 255) | 0;
        data[i + 2] = 200;
        data[i + 3] = 255;
      }
    }
    const normalTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.needsUpdate = true;

    const water = new Water(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normalTex,
      sunDirection: sunDirection,
      sunColor: 0xfff5e0,
      waterColor: 0x0e3d5c,
      distortionScale: 3.0,
      fog: true,
      alpha: 0.88,
    });

    water.rotation.x = -Math.PI / 2;
    water.position.y = -17;

    waterRef.current = water;
    groupRef.current.add(water);

    return () => {
      groupRef.current?.remove(water);
      geometry.dispose();
      normalTex.dispose();
      water.material.dispose();
    };
  }, [sunDirection, waterRef]);

  return <group ref={groupRef} />;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
