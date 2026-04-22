import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";

// Model is ~2000x2000 in XZ, ~40 tall after centering at origin
const CAMERA_POINTS = [
  // 0: Aerial overview (south-west)
  { pos: [1400, 1000, 1400], target: [0, 0, 0] },
  // 1: North approach
  { pos: [-800, 500, 1000], target: [100, 0, -100] },
  // 2: South approach
  { pos: [1000, 500, -700], target: [0, 0, 100] },
  // 3: Marina close-up
  { pos: [-400, 150, -300], target: [-600, 0, -500] },
  // 4: Travel lift / waterfront
  { pos: [400, 200, -600], target: [200, 20, -300] },
  // 5: Low angle hero shot
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

export function Scene({
  flying,
  cameraIndex,
}: SceneProps) {
  const { scene } = useGLTF("/tipner.glb");
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const flyProgress = useRef(0);
  const flyCurve = useMemo(() => buildFlyPath(), []);

  const animating = useRef(false);
  const animStart = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
  const animEnd = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
  const animT = useRef(0);

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
      camera.position.lerpVectors(animStart.current.pos, animEnd.current.pos, t);
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

  // Center the model
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[800, 1500, 800]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={4000}
        shadow-camera-left={-1500}
        shadow-camera-right={1500}
        shadow-camera-top={1500}
        shadow-camera-bottom={-1500}
      />
      <directionalLight position={[-600, 800, -400]} intensity={0.4} />
      <Environment preset="city" background={false} />

      {/* Sky */}
      <mesh>
        <sphereGeometry args={[5000, 32, 32]} />
        <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} />
      </mesh>

      <primitive object={scene} />

      <ContactShadows
        position={[0, -1, 0]}
        opacity={0.3}
        scale={3000}
        blur={2}
        far={1500}
      />

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
