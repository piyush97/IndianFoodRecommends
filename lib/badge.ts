const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Average glyph width for 13px system sans; generous so text never clips.
const CHAR_PX = 7.4;
const PAD = 12;

/** Small "featured on" badge a creator can embed. Text only, no external assets. */
export function badgeSvg({ name, picks }: { name: string; picks: number }): string {
  const label = escapeXml(name.slice(0, 60));
  const value = `${picks} ${picks === 1 ? "pick" : "picks"} on Indian Food Recommends`;
  const leftW = Math.ceil(name.slice(0, 60).length * CHAR_PX) + PAD * 2;
  const rightW = Math.ceil(value.length * CHAR_PX) + PAD * 2;
  const width = leftW + rightW;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" viewBox="0 0 ${width} 28" role="img" aria-label="${label}: ${value}">
<title>${label}: ${value}</title>
<rect width="${leftW}" height="28" rx="6" fill="#1a1614"/>
<rect x="${leftW - 6}" width="${rightW + 6}" height="28" rx="6" fill="#9a3412"/>
<rect x="${leftW - 6}" width="6" height="28" fill="#9a3412"/>
<g fill="#fdfbf7" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="13">
<text x="${PAD}" y="18">${label}</text>
<text x="${leftW + PAD}" y="18">${value}</text>
</g>
</svg>`;
}
