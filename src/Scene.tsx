import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Sky } from "@react-three/drei";
import * as THREE from "three";
import {
  createConcreteTextures,
  createGrassTextures,
  createBrickTextures,
  createWoodTextures,
  createTarmacTextures,
  createRoofTextures,
  createHardstandTextures,
  createSteelTextures,
  applyProceduralTexture,
  type ProceduralTexture,
} from "./textures";

// Simple color-only overrides for materials that don't need full procedural textures
const SIMPLE_FIXES: Record<
  string,
  { color: string; roughness?: number; metalness?: number; envMapIntensity?: number }
> = {
  ParkLine: { color: "#e8e4d8", roughness: 0.6 },
  Gate: { color: "#404248", roughness: 0.5, metalness: 0.65, envMapIntensity: 0.8 },
  Cradle: { color: "#2a4570", roughness: 0.5, metalness: 0.6, envMapIntensity: 0.7 },
  Hoist: { color: "#d4a810", roughness: 0.35, metalness: 0.55, envMapIntensity: 0.9 },
  HoistStl: { color: "#606060", roughness: 0.3, metalness: 0.85, envMapIntensity: 1.0 },
  Green: { color: "#2d6b3f", roughness: 0.5, metalness: 0.3 },
  HullB: { color: "#0a1840", roughness: 0.08, envMapIntensity: 1.5 },
  HullD: { color: "#040a1e", roughness: 0.08, envMapIntensity: 1.5 },
  HullW: { color: "#f0f0ec", roughness: 0.08, envMapIntensity: 1.2 },
  Super: { color: "#f5f5f3", roughness: 0.06, envMapIntensity: 1.5 },
  Glass: { color: "#6080a0", roughness: 0.01, metalness: 0.1, envMapIntensity: 2.0 },
  Deck: { color: "#c4a060", roughness: 0.7 },
  CarBlk: { color: "#050505", roughness: 0.15, envMapIntensity: 1.5 },
  CarBlu: { color: "#0c2860", roughness: 0.2, envMapIntensity: 1.2 },
  CarRed: { color: "#8c1408", roughness: 0.2, envMapIntensity: 1.2 },
  CarSlv: { color: "#a5a5a0", roughness: 0.15, metalness: 0.55, envMapIntensity: 1.5 },
  CarWht: { color: "#e8e8e5", roughness: 0.15, envMapIntensity: 1.2 },
};

// Map material names to procedural texture generators
const PROCEDURAL_MAP: Record<string, () => ProceduralTexture> = {
  Concrete: createConcreteTextures,
  Hardstand: createHardstandTextures,
  Tarmac: createTarmacTextures,
  Road: createTarmacTextures,
  Brick: createBrickTextures,
  Grass: createGrassTextures,
  Roof: createRoofTextures,
};

// All pontoon variants get wood
for (let i = 0; i <= 8; i++) {
  const key = i === 0 ? "Pontoon" : `Pontoon.00${i}`;
  PROCEDURAL_MAP[key] = createWoodTextures;
}

// Steel for piles and dolphins
PROCEDURAL_MAP["Pile"] = createSteelTextures;
PROCEDURAL_MAP["Dolphin"] = createSteelTextures;

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

    // Cache procedural textures so shared materials reuse the same textures
    const texCache: Record<string, ProceduralTexture> = {};

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

      // Procedural textures (color + normal + roughness maps)
      const procGen = PROCEDURAL_MAP[mat.name];
      if (procGen) {
        if (!texCache[mat.name]) {
          texCache[mat.name] = procGen();
        }
        const envI = mat.name === "Pile" || mat.name === "Dolphin" ? 0.8
          : mat.name === "Roof" ? 0.7 : 0.5;
        applyProceduralTexture(mat, texCache[mat.name], envMap, envI);
        return;
      }

      // Simple color overrides
      const fix = SIMPLE_FIXES[mat.name];
      if (fix) {
        mat.color.set(fix.color);
        if (fix.roughness !== undefined) mat.roughness = fix.roughness;
        if (fix.metalness !== undefined) mat.metalness = fix.metalness;
        mat.envMap = envMap;
        mat.envMapIntensity = fix.envMapIntensity ?? 0.6;
        mat.needsUpdate = true;
      } else {
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

      {/* Water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -17, 0]}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#4a90b8" roughness={0.3} metalness={0.1} envMapIntensity={0.4} />
      </mesh>

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

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
