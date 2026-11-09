import { and, exists, ne, eq, sql } from "drizzle-orm";
import { schema, type Db } from "../db";

export type Nearby = { slug: string; meters: number };

/**
 * Places within `radiusKm` of a point that have an approved pick, nearest first. Uses the
 * `places_geo_idx` GiST index (earthdistance): `earth_box @>` narrows by bounding box through
 * the index, `<->` orders nearest-first through it, and `earth_distance` trims the box's
 * corners to a true circle.
 */
export async function nearbyPlaces(
  db: Db,
  {
    lat,
    lng,
    radiusKm,
    limit,
    exceptSlug,
  }: {
    lat: number;
    lng: number;
    radiusKm: number;
    limit: number;
    exceptSlug?: string;
  },
): Promise<Nearby[]> {
  const p = schema.places;
  const r = schema.recommendations;
  const here = sql`ll_to_earth(${lat}::float8, ${lng}::float8)`;
  const there = sql`ll_to_earth(${p.lat}, ${p.lng})`;
  const radiusM = radiusKm * 1000;
  const rows = await db
    .select({ slug: p.slug, meters: sql<number>`earth_distance(${here}, ${there})` })
    .from(p)
    .where(
      and(
        sql`earth_box(${here}, ${radiusM}::float8) @> ${there}`,
        sql`earth_distance(${here}, ${there}) <= ${radiusM}::float8`,
        exceptSlug ? ne(p.slug, exceptSlug) : undefined,
        exists(
          db
            .select({ one: sql`1` })
            .from(r)
            .where(and(eq(r.placeId, p.id), eq(r.status, "approved"))),
        ),
      ),
    )
    .orderBy(sql`${there} <-> ${here}`)
    .limit(limit);
  return rows.map((row) => ({ slug: row.slug, meters: Number(row.meters) }));
}
