/** Latin diacritics become ascii; Devanagari marks (>= U+0900) survive. */
function foldDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u08ff]/g, "");
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
