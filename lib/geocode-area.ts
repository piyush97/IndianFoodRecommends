import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "../db";
import { haversineKm } from "../components/near-me";
import {
  ACCEPT,
  areaKey,
  matchAreas,
  type AreaHit,
  rememberUpstream,
  suggestionsFrom,
  withoutCity,
} from "./areas";
import { CITIES } from "./cities";
import { suggestLocation } from "./review";

/** A typed area must land this close to the city's places, or it is probably another town. */
const MAX_KM = 100;

export type AreaSuggestion = { name: string; lat: number; lng: number };

export type AreaResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      label: string;
      /** Where the answer came from: our own area list, or OpenStreetMap search. */
      via: "local" | "openstreetmap";
    }
  | {
      ok: false;
      status: 400 | 404 | 429 | 502;
      error: string;
      suggestions: AreaSuggestion[];
    };

/** Thrown by a `geocode` implementation that may not call upstream right now. */
export class UpstreamBusy extends Error {}

const fail = (
  status: 400 | 404 | 429 | 502,
  error: string,
  suggestions: AreaSuggestion[] = [],
): AreaResult => ({ ok: false, status, error, suggestions });

/** Matches the query as typed and with the city name dropped, keeping each area's best score. */
async function localHits(db: Db, cityId: number, q: string, city: { slug: string; name: string }) {
  const stripped = withoutCity(q, city.slug, city.name);
  const lists = [await matchAreas(db, cityId, q)];
  if (stripped !== areaKey(q)) lists.push(await matchAreas(db, cityId, stripped));
  const best = new Map<number, AreaHit>();
  for (const hit of lists.flat()) {
    if ((best.get(hit.id)?.score ?? -1) < hit.score) best.set(hit.id, hit);
  }
  return [...best.values()].sort((x, y) => y.score - x.score);
}

/**
 * Turns "Connaught Place", "cp" or "chandini chowk" into coordinates inside one city.
 * Order: our own area list (exact, nickname, close spelling), then OpenStreetMap search with the
 * answer remembered, then "did you mean" choices. Local answers need no upstream call.
 */
export async function findArea(
  db: Db,
  citySlug: string,
  rawQuery: string,
  geocode: typeof suggestLocation = suggestLocation,
): Promise<AreaResult> {
  const city = CITIES.find((c) => c.slug === citySlug);
  const q = rawQuery.trim().replace(/\s+/g, " ");
  if (!city || q.length < 2 || q.length > 80) return fail(400, "Type 2 to 80 characters.");

  const [row] = await db
    .select({ id: schema.cities.id })
    .from(schema.cities)
    .where(eq(schema.cities.slug, city.slug));
  const hits = row ? await localHits(db, row.id, q, city) : [];
  const best = hits[0];
  if (best && best.score >= ACCEPT) {
    return { ok: true, lat: best.lat, lng: best.lng, label: best.name, via: "local" };
  }
  const suggestions = suggestionsFrom(hits).map(({ name, lat, lng }) => ({ name, lat, lng }));
  const notFound = fail(404, `Could not find that place in ${city.name}.`, suggestions);

  let hit;
  try {
    hit = await geocode(`${q}, ${city.name}`);
  } catch (error) {
    if (suggestions.length > 0) return notFound;
    return error instanceof UpstreamBusy
      ? fail(429, "Too many searches at once. Try again in a few seconds.")
      : fail(502, "Place search is not answering. Try again soon.");
  }
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
  if (row) await rememberUpstream(db, row.id, q, hit).catch(() => undefined);
  return { ok: true, lat: hit.lat, lng: hit.lng, label: q, via: "openstreetmap" };
}
