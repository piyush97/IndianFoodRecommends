import { and, exists, ne, eq, sql } from "drizzle-orm";
import { schema, type Db } from "../db";

export type Nearby = { slug: string; meters: number };

/**
 * Places that are not closed within `radiusKm` of a point and have an approved pick, nearest
 * first. Uses the `places_geom_idx` PostGIS GiST index: `ST_DWithin` narrows to the circle through
 * it and `<->` orders nearest-first through it, both in metres on a geography column.
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
  const here = sql`ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography`;
  const radiusM = radiusKm * 1000;
  const rows = await db
    .select({ slug: p.slug, meters: sql<number>`ST_Distance(${p.geom}, ${here})` })
    .from(p)
    .where(
      and(
        sql`ST_DWithin(${p.geom}, ${here}, ${radiusM}::float8)`,
        ne(p.status, "closed"),
        exceptSlug ? ne(p.slug, exceptSlug) : undefined,
        exists(
          db
            .select({ one: sql`1` })
            .from(r)
            .where(and(eq(r.placeId, p.id), eq(r.status, "approved"))),
        ),
      ),
    )
    .orderBy(sql`${p.geom} <-> ${here}`)
    .limit(limit);
  return rows.map((row) => ({ slug: row.slug, meters: Number(row.meters) }));
}
