import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";
import { Overlay } from "./Overlay";
import { useState, Suspense } from "react";

export default function App() {
  const [flying, setFlying] = useState(false);
  const [cameraIndex, setCameraIndex] = useState(0);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a0a" }}>
      <Canvas
        shadows
        camera={{ position: [1400, 1000, 1400], fov: 45, near: 1, far: 10000 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: 4, toneMappingExposure: 1.1 }}
      >
        <Suspense fallback={null}>
          <Scene
            flying={flying}
            setFlying={setFlying}
            cameraIndex={cameraIndex}
            setCameraIndex={setCameraIndex}
          />
        </Suspense>
      </Canvas>
      <Overlay
        flying={flying}
        setFlying={setFlying}
        cameraIndex={cameraIndex}
        setCameraIndex={setCameraIndex}
      />
    </div>
  );
}
