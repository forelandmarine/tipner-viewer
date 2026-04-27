import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";

export function LoadingScreen() {
  const { active, progress, loaded, total } = useProgress();
  const [hide, setHide] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (!active && progress >= 100) {
      const t1 = setTimeout(() => setHide(true), 250);
      const t2 = setTimeout(() => setRemoved(true), 900);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [active, progress]);

  if (removed) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a0a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        zIndex: 100,
        opacity: hide ? 0 : 1,
        transition: "opacity 600ms ease-out",
        pointerEvents: hide ? "none" : "auto",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          Tipner West Shipyard
        </h1>
        <p style={{ fontSize: 13, margin: "6px 0 0", opacity: 0.55 }}>
          Foreland Shipyard Group
        </p>
      </div>

      <div
        style={{
          width: 320,
          height: 4,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.max(2, progress)}%`,
            background: "linear-gradient(90deg, #6090c0, #b8d4e8)",
            transition: "width 200ms ease-out",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          fontSize: 12,
          opacity: 0.6,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>Loading 3D model</span>
        <span>{Math.round(progress)}%</span>
        {total > 0 && (
          <span style={{ opacity: 0.7 }}>
            {loaded}/{total} assets
          </span>
        )}
      </div>
    </div>
  );
}
