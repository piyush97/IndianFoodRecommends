import { sql } from "drizzle-orm";
import type { Db } from "../../db";
import { CITIES } from "../cities";
import { matchOsm, parseOverpass, weekSchedule } from "../opening-hours";

type PlaceRow = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  osmId: string | null;
  openingHours: string | null;
  openingWeek: string | null;
};

export type OsmHoursSummary = {
  city: string;
  places?: number;
  matched?: number;
  changed?: number;
  error?: string;
};

const sameWeek = (stored: string | null, next: unknown) =>
  stored === null ? next === null : JSON.stringify(JSON.parse(stored)) === JSON.stringify(next);

const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAYS = [30_000, 60_000, 120_000, 240_000];

/** Sequential requests to the public Overpass service. A city whose fetch or parse fails keeps its stored hours. */
export async function importOsmHours(
  db: Db,
  onlyCity?: string,
  fetchImpl: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise<void>((r) => setTimeout(r, ms)),
): Promise<OsmHoursSummary[]> {
  if (onlyCity && !CITIES.some((c) => c.slug === onlyCity)) throw new Error("Unknown city");
  const userAgent = process.env.NOMINATIM_USER_AGENT;
  if (!userAgent) throw new Error("NOMINATIM_USER_AGENT must include a contact address");
  const summary: OsmHoursSummary[] = [];
  const cities = CITIES.filter((c) => !onlyCity || c.slug === onlyCity);
  for (const [index, city] of cities.entries()) {
    if (index > 0) await wait(10_000);
    try {
      const places = await db.execute<PlaceRow>(sql`
        select p.id, p.name, p.lat, p.lng, p.osm_id as "osmId", p.opening_hours as "openingHours",
          p.opening_week::text as "openingWeek"
        from places p join cities c on c.id = p.city_id
        where c.slug = ${city.slug} and p.lat between 6 and 37 and p.lng between 68 and 98
          and p.osm_id is not null and p.osm_id not like 'approx:%'`);
      const lats = places.map((p) => p.lat);
      const lngs = places.map((p) => p.lng);
      const [s, w, n, e] = [
        Math.min(...lats) - 0.1,
        Math.min(...lngs) - 0.1,
        Math.max(...lats) + 0.1,
        Math.max(...lngs) + 0.1,
      ];
      if (!places.length || e - w > 3 || n - s > 3)
        throw new Error("No safe city extent in catalog");
      const query = `[out:json][timeout:60];nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"]["opening_hours"](${s},${w},${n},${e});out center tags;`;
      let response: Response;
      for (let attempt = 1; ; attempt++) {
        try {
          response = await fetchImpl("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: new URLSearchParams({ data: query }),
            headers: { "User-Agent": userAgent },
            signal: AbortSignal.timeout(90000),
          });
        } catch (error) {
          if (attempt > RETRY_DELAYS.length) throw error;
          await wait(RETRY_DELAYS[attempt - 1]);
          continue;
        }
        if (response.ok) break;
        if (!RETRY_STATUSES.has(response.status) || attempt > RETRY_DELAYS.length)
          throw new Error(`Overpass HTTP ${response.status}`);
        await wait(RETRY_DELAYS[attempt - 1]);
      }
      const body = await response.text();
      if (body.length > 20_000_000) throw new Error("Overpass response exceeds 20 MB");
      const foods = parseOverpass(JSON.parse(body));

      // Only exact pins are matched: an approx pin is a neighbourhood centre, not the shop.
      const now = new Date();
      const updates: { id: number; hours: string | null; week: unknown }[] = [];
      let eligible = 0;
      let matched = 0;
      for (const place of places) {
        if (!place.osmId || place.osmId.startsWith("approx:")) continue;
        eligible++;
        const food = matchOsm({ ...place, osmId: place.osmId }, foods);
        const week = food ? weekSchedule(food.openingHours, now) : null;
        const hours = food?.openingHours ?? null;
        if (food) matched++;
        if (hours !== place.openingHours || !sameWeek(place.openingWeek, week))
          updates.push({ id: place.id, hours, week });
      }

      // The fetch and parse above ran first, so any failure left every row untouched.
      await db.transaction(async (tx) => {
        for (const u of updates) {
          await tx.execute(sql`
            update places set opening_hours = ${u.hours},
              opening_week = ${u.week === null ? null : JSON.stringify(u.week)}::text::jsonb
            where id = ${u.id}`);
        }
        await tx.execute(sql`
          update places p set opening_hours_checked = (now() at time zone 'Asia/Kolkata')::date
          from cities c where c.id = p.city_id and c.slug = ${city.slug}
            and p.osm_id is not null and p.osm_id not like 'approx:%'
            and p.lat between 6 and 37 and p.lng between 68 and 98`);
      });
      summary.push({ city: city.slug, places: eligible, matched, changed: updates.length });
    } catch (error) {
      summary.push({
        city: city.slug,
        error: error instanceof Error ? error.message : "Import failed",
      });
    }
  }
  return summary;
}
