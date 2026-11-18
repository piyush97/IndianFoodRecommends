import { cacheLife, cacheTag } from "next/cache";
import { db } from "../../db";
import type { DietFilter } from "../../lib/diet";
import { inRequestOrder, listCacheKey } from "../../lib/list-params";
import { getArea, getSpatialPicks, listAreas, getWalks } from "../../lib/public/spatial";
import {
  getAllCards,
  getCity,
  getCreator,
  getDishInCity,
  getHome,
  getListCards,
  getPlace,
  listActiveCities,
  listCreators,
} from "../../lib/public/queries";

// Cached reads for public pages. Every entry carries the `public` tag so the
// worker can refresh everything after a run with one revalidateTag call.

export async function cachedCities() {
  "use cache";
  cacheLife("hours");
  cacheTag("public");
  return listActiveCities(db);
}

export async function cachedHome(city: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `city:${city}`);
  return getHome(db, city);
}

export async function cachedCity(city: string, diet?: DietFilter) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `city:${city}`);
  return getCity(db, city, undefined, diet);
}

export async function cachedDish(city: string, dish: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `city:${city}`, `dish:${dish}`);
  return getDishInCity(db, city, dish);
}

export async function cachedPlace(city: string, slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `city:${city}`, `place:${slug}`);
  return getPlace(db, city, slug);
}

export async function cachedCreator(slug: string, dish?: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `creator:${slug}`);
  return getCreator(db, slug, dish);
}
export async function cachedCreators() {
  "use cache";
  cacheLife("hours");
  cacheTag("public");
  return listCreators(db);
}

export async function cachedAreas(city: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `city:${city}`);
  return listAreas(db, city);
}

export async function cachedWalks(city: string, slug?: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("public", `city:${city}`);
  return getWalks(db, city, slug);
}

export async function cachedArea(city: string, slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `city:${city}`);
  const area = await getArea(db, city, slug);
  return area ? { area, places: await getSpatialPicks(db, city, { area: slug }) } : null;
}

/** `key` is `listCacheKey(slugs)`: sorted and deduped, so permutations share one entry. */
async function cachedListByKey(key: string) {
  "use cache";
  const slugs = key.split(",").filter(Boolean);
  cacheLife("minutes");
  cacheTag("public", ...slugs.map((s) => `place:${s}`));
  return getListCards(db, slugs);
}

/** Cards for `slugs` (already through `parseListParam`) in the requested order; the order is applied outside the cache. */
export async function cachedList(slugs: string[]) {
  return inRequestOrder(await cachedListByKey(listCacheKey(slugs)), slugs);
}

export async function cachedAllCards() {
  "use cache";
  cacheLife("hours");
  cacheTag("public");
  return getAllCards(db);
}
