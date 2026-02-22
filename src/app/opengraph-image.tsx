import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "linear-gradient(145deg, #f0fdfa 0%, #e0f2fe 40%, #cffafe 100%)",
          color: "#0f172a",
          fontFamily: "Arial",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 1.5, textTransform: "uppercase", color: "#0f766e" }}>fitPulse</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.02 }}>Fitbit Health Dashboard</div>
          <div style={{ fontSize: 34, color: "#334155" }}>Recovery, Sleep, Zone 2, and Coaching Insights</div>
        </div>
        <div style={{ fontSize: 28, color: "#0f766e" }}>github.com/anup4khandelwal/fitPulse</div>
      </div>
    ),
    size,
  );
}
