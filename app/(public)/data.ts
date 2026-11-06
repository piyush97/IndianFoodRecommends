import { cacheLife, cacheTag } from "next/cache";
import { db } from "../../db";
import { getCity, getCreator, getDishInCity, getHome, getPlace } from "../../lib/public/queries";

// Cached reads for public pages. Every entry carries the `public` tag so the
// worker can refresh everything after a run with one revalidateTag call.

export async function cachedHome(city: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `city:${city}`);
  return getHome(db, city);
}

export async function cachedCity(city: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("public", `city:${city}`);
  return getCity(db, city);
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
