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
