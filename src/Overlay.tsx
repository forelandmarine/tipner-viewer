const VIEW_LABELS = [
  "Aerial Overview",
  "North Approach",
  "South Approach",
  "Marina Close-up",
  "Travel Lift",
  "Hero Shot",
];

interface OverlayProps {
  flying: boolean;
  setFlying: (f: boolean) => void;
  cameraIndex: number;
  setCameraIndex: (i: number) => void;
}

export function Overlay({
  flying,
  setFlying,
  cameraIndex,
  setCameraIndex,
}: OverlayProps) {
  return (
    <>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 32,
          color: "white",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "0.02em",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          Tipner West Shipyard
        </h1>
        <p
          style={{
            fontSize: 13,
            margin: "4px 0 0",
            opacity: 0.6,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          Foreland Shipyard Group
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        {/* Fly-through toggle */}
        <button onClick={() => setFlying(!flying)} style={btnStyle(flying)}>
          {flying ? "Stop Fly-through" : "Fly-through"}
        </button>

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />

        {/* View presets */}
        {VIEW_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => {
              setFlying(false);
              setCameraIndex(i);
            }}
            style={btnStyle(cameraIndex === i && !flying)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.4)",
          fontSize: 12,
          fontFamily: "'Inter', system-ui, sans-serif",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {flying
          ? "Press Stop or click a view to exit fly-through"
          : "Drag to orbit, scroll to zoom, right-click to pan"}
      </div>
    </>
  );
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    fontSize: 13,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 500,
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    background: active ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.5)",
    color: active ? "#fff" : "rgba(255,255,255,0.7)",
    cursor: "pointer",
    backdropFilter: "blur(12px)",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  };
}
