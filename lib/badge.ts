const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Average glyph width for 13px system sans; generous so text never clips.
const CHAR_PX = 7.4;
const PAD = 12;

const LABEL = "Featured on Indian Food Recommends";
// Left half per theme; the accent half (#fdfbf7 on #9a3412, 7:1) is the same in both.
const THEMES = {
  dark: { bg: "#1a1614", fg: "#fdfbf7" },
  light: { bg: "#fdfbf7", fg: "#1a1614" },
} as const;
export type BadgeTheme = keyof typeof THEMES;

export function badgeTheme(param: string | null): BadgeTheme {
  return param === "light" ? "light" : "dark";
}

const pickCount = (n: number) => `${n} ${n === 1 ? "pick" : "picks"}`;

/** "Featured on" badge a creator can embed. Text only, no external assets. */
export function badgeSvg({
  name,
  picks,
  theme = "dark",
}: {
  name: string;
  picks: number;
  theme?: BadgeTheme;
}): string {
  const { bg, fg } = THEMES[theme];
  const value = pickCount(picks);
  const title = `${escapeXml(name.slice(0, 60))}: ${value} on Indian Food Recommends`;
  const leftW = Math.ceil(LABEL.length * CHAR_PX) + PAD * 2;
  const rightW = Math.ceil(value.length * CHAR_PX) + PAD * 2;
  const width = leftW + rightW;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" viewBox="0 0 ${width} 28" role="img" aria-label="${title}">
<title>${title}</title>
<rect x="0.5" y="0.5" width="${leftW}" height="27" rx="6" fill="${bg}" stroke="#1a1614"/>
<rect x="${leftW - 6}" width="${rightW + 6}" height="28" rx="6" fill="#9a3412"/>
<rect x="${leftW - 6}" width="6" height="28" fill="#9a3412"/>
<g font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="13">
<text x="${PAD}" y="18" fill="${fg}">${LABEL}</text>
<text x="${leftW + PAD}" y="18" fill="#fdfbf7">${value}</text>
</g>
</svg>`;
}

/** Places with the most of this creator's dishes first; ties keep query order. */
export function topPlaces<T extends { placeName: string; dishes: string[] }>(picks: T[], n = 3) {
  return [...picks].sort((a, b) => b.dishes.length - a.dishes.length).slice(0, n);
}

/** Plain share text for a video description or community post. Only counts the DB returned. */
export function kitShareText({
  total,
  picks,
  url,
}: {
  total: number;
  picks: { placeName: string; dishes: string[] }[];
  url: string;
}): string {
  const top = topPlaces(picks).map((p) => `- ${p.placeName}: ${p.dishes.join(", ")}`);
  return [
    `${pickCount(total)} from my videos are on Indian Food Recommends, each linked to the moment in the video.`,
    ...(top.length ? ["", "Top places:", ...top] : []),
    "",
    `Map and timestamps: ${url}`,
  ].join("\n");
}
