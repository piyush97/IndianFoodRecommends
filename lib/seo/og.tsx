import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

// Brand tokens from app/globals.css (light theme).
const INK = "#1a1614";
const MUTED = "#6b635c";
const PAPER = "#fdfbf7";
const ACCENT = "#9a3412";

/** Shared 1200×630 card. Text only, default font: no network fetch at render time. */
export function ogCard({ title, subline }: { title: string; subline?: string }): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PAPER,
        padding: "72px 80px",
        borderLeft: `24px solid ${ACCENT}`,
      }}
    >
      <div style={{ display: "flex", fontSize: 32, color: ACCENT, fontWeight: 700 }}>
        Indian Food Recommends
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 48 ? 64 : 80,
            lineHeight: 1.1,
            color: INK,
            fontWeight: 700,
          }}
        >
          {title.slice(0, 90)}
        </div>
        {subline && (
          <div style={{ display: "flex", fontSize: 36, color: MUTED }}>{subline.slice(0, 110)}</div>
        )}
      </div>
    </div>,
    ogSize,
  );
}
