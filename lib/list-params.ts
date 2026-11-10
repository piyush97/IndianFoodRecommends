import { MAX_LIST, SLUG_RE } from "./list-core";
import { cityBySlug } from "./cities";
import type { PickCard } from "./public/queries";

// 30 slugs of 80 chars plus commas; anything longer is cut before it is split.
const MAX_RAW = MAX_LIST * 82;

/** `?p=` is user input: first value only, bad slugs skipped, deduped, at most MAX_LIST. Never throws. */
export function parseListParam(p: string | string[] | undefined): string[] {
  const raw = Array.isArray(p) ? p[0] : p;
  if (typeof raw !== "string") return [];
  const cut = raw.length > MAX_RAW;
  const parts = raw.slice(0, MAX_RAW).split(",");
  if (cut) parts.pop();
  const out: string[] = [];
  for (const s of parts) {
    if (SLUG_RE.test(s) && !out.includes(s)) out.push(s);
    if (out.length === MAX_LIST) break;
  }
  return out;
}

export function creatorCount(cards: PickCard[]): number {
  return new Set(cards.flatMap((c) => c.creators.map((cr) => cr.slug))).size;
}

export function listShareText(cards: PickCard[]): string {
  const n = cards.length;
  const m = creatorCount(cards);
  const cities = [...new Set(cards.map((c) => c.citySlug))];
  const where =
    cities.length === 1
      ? `in ${cityBySlug(cities[0])?.name ?? cities[0]}`
      : `across ${cities.length} cities`;
  return `${n} ${n === 1 ? "place" : "places"} to eat ${where}, picked by ${m} food ${m === 1 ? "vlogger" : "vloggers"}`;
}

/** Cache key for a list: sorted and deduped, so every ordering of the same slugs shares one entry. */
export function listCacheKey(slugs: string[]): string {
  return [...new Set(slugs)].sort().join(",");
}

/** Put cards back in the order the visitor asked for. */
export function inRequestOrder(cards: PickCard[], slugs: string[]): PickCard[] {
  return [...cards].sort((a, b) => slugs.indexOf(a.placeSlug) - slugs.indexOf(b.placeSlug));
}
