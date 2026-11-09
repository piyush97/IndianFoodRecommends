import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CITIES } from "../cities";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

// Tokens from app/globals.css; an image cannot read CSS variables. og.test.ts keeps them in sync.
export const OG_COLORS = {
  ink: "#1d1a16",
  muted: "#5c554c",
  paper: "#f2eee5",
  line: "#cfc6b4",
  accent: "#b8361d",
};
export const OG_ROUTE: Record<string, { bg: string; fg: string; code: string }> = {
  delhi: { bg: "#b8361d", fg: OG_COLORS.paper, code: "DL" },
  mumbai: { bg: "#2a6b45", fg: OG_COLORS.paper, code: "MB" },
  kolkata: { bg: "#e2a823", fg: OG_COLORS.ink, code: "KL" },
  hyderabad: { bg: "#2e4a86", fg: OG_COLORS.paper, code: "HY" },
  bengaluru: { bg: "#6b3a7d", fg: OG_COLORS.paper, code: "BL" },
  chennai: { bg: "#1f6f78", fg: OG_COLORS.paper, code: "CH" },
  lucknow: { bg: "#7a4a1d", fg: OG_COLORS.paper, code: "LK" },
  jaipur: { bg: "#a8336a", fg: OG_COLORS.paper, code: "JP" },
};

// Archivo, the site's typeface, as two static cuts (condensed 800 for the lid voice, regular
// 500 for sentences). Bundled so the card never waits on a font download.

const lid = { fontFamily: "Archivo Lid", textTransform: "uppercase" as const, lineHeight: 0.95 };

/**
 * Shared 1200x630 share card in the site's look: cotton ground, condensed ink title, painted
 * city tile. `lid` adds the signature tile (city code, creators who agree); without it the
 * card shows every city as a tile. Text only: no food or place photos exist to show.
 */
export async function ogCard({
  title,
  subline,
  lid: tile,
}: {
  title: string;
  subline?: string;
  lid?: { city: string; count: number; label?: string };
}) {
  // Literal paths so Vercel's file tracing ships the fonts with the function.
  const [lidFont, bodyFont] = await Promise.all([
    readFile(join(process.cwd(), "lib/seo/fonts/Archivo-Lid.ttf")),
    readFile(join(process.cwd(), "lib/seo/fonts/Archivo-Body.ttf")),
  ]);
  const t = title.slice(0, 90);
  const route = tile && (OG_ROUTE[tile.city] ?? OG_ROUTE.delhi);
  const size = t.length <= 14 ? 168 : t.length <= 30 ? 124 : 92;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG_COLORS.paper,
        padding: "56px 72px 56px",
        color: OG_COLORS.ink,
      }}
    >
      <div
        style={{
          ...lid,
          display: "flex",
          fontSize: 44,
          gap: 14,
          paddingBottom: 18,
          borderBottom: `4px solid ${OG_COLORS.ink}`,
        }}
      >
        <span>Indian Food</span>
        <span style={{ color: OG_COLORS.accent }}>Recommends</span>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 48,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1 }}>
          <div style={{ ...lid, fontSize: size, display: "flex" }}>{t}</div>
          {subline && (
            <div
              style={{
                display: "flex",
                fontFamily: "Archivo Body",
                fontSize: 36,
                lineHeight: 1.25,
                color: OG_COLORS.muted,
              }}
            >
              {subline.slice(0, 110)}
            </div>
          )}
        </div>
        {route && tile && (
          <div
            style={{
              ...lid,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 260,
              height: 300,
              borderRadius: 8,
              background: route.bg,
              color: route.fg,
              boxShadow: "inset 0 0 0 3px rgba(0,0,0,0.18)",
            }}
          >
            <span style={{ display: "flex", fontSize: 56 }}>{route.code}</span>
            <span style={{ display: "flex", fontSize: 168 }}>{tile.count}</span>
            <span
              style={{
                display: "flex",
                textTransform: "none",
                fontFamily: "Archivo Body",
                fontSize: 34,
              }}
            >
              {tile.label ?? (tile.count === 1 ? "creator" : "creators")}
            </span>
          </div>
        )}
      </div>

      {!tile && (
        <div style={{ display: "flex", gap: 10 }}>
          {CITIES.map((c) => {
            const r = OG_ROUTE[c.slug];
            return (
              <div
                key={c.slug}
                style={{
                  ...lid,
                  display: "flex",
                  fontSize: 30,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: r.bg,
                  color: r.fg,
                }}
              >
                {c.name}
              </div>
            );
          })}
        </div>
      )}
    </div>,
    {
      ...ogSize,
      fonts: [
        { name: "Archivo Lid", data: lidFont, weight: 800, style: "normal" },
        { name: "Archivo Body", data: bodyFont, weight: 500, style: "normal" },
      ],
    },
  );
}
