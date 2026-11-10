import { ImageResponse } from "next/og";
import { cityBySlug, cityFromName } from "../cities";
import type { PickCard } from "../public/queries";
import { lid, OG_COLORS, OG_ROUTE, ogFonts } from "./og";
import { SITE_URL } from "./site";

export const storySize = { width: 1080, height: 1920 };

export type StoryLines = { title: string; places: { name: string; city: string }[] };

const clip = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

/** What the story shows: creator title plus their top five open places, in rank order. */
export function storyLines(data: { creator: { name: string }; picks: PickCard[] }): StoryLines {
  return {
    title: `${clip(data.creator.name)}'s picks`,
    places: data.picks.slice(0, 5).map((p) => ({
      name: clip(p.placeName),
      city: cityBySlug(p.citySlug)?.name ?? p.citySlug,
    })),
  };
}

/**
 * 1080x1920 story image (Instagram, WhatsApp status) in the site's look. Text only: no food
 * or place photos exist to show.
 */
export async function storyCard({ title, places }: StoryLines) {
  const fonts = await ogFonts();
  const size = title.length <= 24 ? 132 : 100;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG_COLORS.paper,
        padding: "96px 80px",
        color: OG_COLORS.ink,
      }}
    >
      <div
        style={{
          ...lid,
          display: "flex",
          fontSize: 56,
          gap: 18,
          paddingBottom: 24,
          borderBottom: `5px solid ${OG_COLORS.ink}`,
        }}
      >
        <span>Indian Food</span>
        <span style={{ color: OG_COLORS.accent }}>Recommends</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 120 }}>
        <div style={{ ...lid, fontSize: size, display: "flex" }}>{title}</div>
        <div
          style={{
            display: "flex",
            fontFamily: "Archivo Body",
            fontSize: 44,
            color: OG_COLORS.muted,
          }}
        >
          On Indian Food Recommends
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          gap: 28,
        }}
      >
        {places.map((p, i) => {
          const city = cityFromName(p.city);
          const route = OG_ROUTE[city?.slug ?? ""] ?? OG_ROUTE.delhi;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 32,
                paddingBottom: 28,
                borderBottom: `3px solid ${OG_COLORS.line}`,
              }}
            >
              <div
                style={{
                  ...lid,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 96,
                  height: 96,
                  borderRadius: 8,
                  fontSize: 44,
                  background: route.bg,
                  color: route.fg,
                }}
              >
                {route.code}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <div style={{ ...lid, display: "flex", fontSize: 52 }}>{p.name}</div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Archivo Body",
                    fontSize: 34,
                    color: OG_COLORS.muted,
                  }}
                >
                  {p.city}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          ...lid,
          display: "flex",
          fontSize: 48,
          color: OG_COLORS.accent,
          textTransform: "none",
        }}
      >
        {SITE_URL.replace(/^https?:\/\//, "")}
      </div>
    </div>,
    { ...storySize, fonts },
  );
}
