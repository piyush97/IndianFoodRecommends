/** Latin diacritics become ascii; only combining marks U+0300-U+036F are stripped. */
function foldDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Lowercase, ascii slug. Devanagari-only input yields "item". */
export function slugify(s: string): string {
  const slug = foldDiacritics(s)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

/** Comparison key: lowercase, diacritics folded, punctuation collapsed to spaces. */
export function normalizeName(s: string): string {
  return foldDiacritics(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that describe how a dish is served, not which dish it is.
const DISH_QUALIFIERS = new Set([
  "desi",
  "ghee",
  "special",
  "famous",
  "classic",
  "authentic",
  "original",
  "traditional",
  "homemade",
  "spicy",
  "crispy",
  "fresh",
  "jumbo",
]);

/**
 * "Desi Ghee Chole Bhature" becomes "Chole Bhature", so one dish is not split into variants.
 * Keeps the name as typed when fewer than two words would remain ("Ghee Roast", "Special Thali").
 */
export function canonicalDishName(raw: string): string {
  const words = raw.trim().split(/\s+/);
  const kept = words.filter((w) => !DISH_QUALIFIERS.has(normalizeName(w)));
  return kept.length >= 2 ? kept.join(" ") : words.join(" ");
}

// Says what kind of shop it is, not which one: "Hotel Shadab" is Shadab.
const SHOP_WORDS = new Set(["hotel", "restaurant", "cafe"]);

/**
 * Place comparison key: no bracketed parts, apostrophes or shop-type words, and no
 * trailing locality ("Karim's Madhyamgram" in Madhyamgram is Karim's). Never strips
 * the last word, so a name that is only a locality stays as typed.
 */
export function placeKey(name: string, locality?: string | null): string {
  const areas = new Set(
    (locality ?? "")
      .split(",")
      .flatMap((part) => [normalizeName(part), ...normalizeName(part).split(" ")])
      .map((a) => a.replace(/ /g, ""))
      .filter(Boolean),
  );
  const words = normalizeName(name.replace(/\([^)]*\)/g, " ").replace(/['’]/g, ""))
    .split(" ")
    .filter((w) => w && !SHOP_WORDS.has(w));
  while (words.length > 1) {
    const last2 = words.slice(-2).join("");
    if (words.length > 2 && areas.has(last2)) words.splice(-2);
    else if (areas.has(words[words.length - 1])) words.pop();
    else break;
  }
  return words.join(" ");
}

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Same number pg_trgm's similarity() gives, for comparing names without a query. */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}
