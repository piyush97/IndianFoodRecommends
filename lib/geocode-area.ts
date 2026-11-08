import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "../db";
import { haversineKm } from "../components/near-me";
import { CITIES } from "./cities";
import { suggestLocation } from "./review";

/** A typed area must land this close to the city's places, or it is probably another town. */
const MAX_KM = 100;

export type AreaResult =
  | { ok: true; lat: number; lng: number; label: string }
  | { ok: false; status: 400 | 404 | 502; error: string };

/** Turns "Connaught Place" into coordinates inside one city, using OpenStreetMap search. */
export async function findArea(
  db: Db,
  citySlug: string,
  rawQuery: string,
  geocode: typeof suggestLocation = suggestLocation,
): Promise<AreaResult> {
  const city = CITIES.find((c) => c.slug === citySlug);
  const q = rawQuery.trim().replace(/\s+/g, " ");
  if (!city || q.length < 2 || q.length > 80) {
    return { ok: false, status: 400, error: "Type 2 to 80 characters." };
  }
  let hit;
  try {
    hit = await geocode(`${q}, ${city.name}`);
  } catch {
    return { ok: false, status: 502, error: "Place search is not answering. Try again soon." };
  }
  const notFound = {
    ok: false,
    status: 404,
    error: `Could not find that place in ${city.name}.`,
  } as const;
  if (!hit) return notFound;

  const [centre] = await db
    .select({
      lat: sql<number | null>`avg(${schema.places.lat})`,
      lng: sql<number | null>`avg(${schema.places.lng})`,
    })
    .from(schema.places)
    .innerJoin(schema.cities, eq(schema.cities.id, schema.places.cityId))
    .where(eq(schema.cities.slug, city.slug));
  if (centre?.lat != null && centre.lng != null) {
    const km = haversineKm(
      { lat: Number(centre.lat), lng: Number(centre.lng) },
      { lat: hit.lat, lng: hit.lng },
    );
    if (km > MAX_KM) return notFound;
  }
  return { ok: true, lat: hit.lat, lng: hit.lng, label: q };
}
