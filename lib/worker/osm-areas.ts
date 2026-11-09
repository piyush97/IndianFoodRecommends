import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db";
import { areaKey } from "../areas";
import { CITIES } from "../cities";
import { slugify } from "../text";

const point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const element = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number().int().positive(),
  tags: z.record(z.string(), z.string()),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: point.optional(),
  geometry: z.array(point).optional(),
  members: z
    .array(
      z.object({
        type: z.string(),
        role: z.string().optional(),
        geometry: z.array(point).optional(),
      }),
    )
    .optional(),
});
type Bounds = [number, number, number, number];
export type OsmArea = {
  name: string;
  slug: string;
  key: string;
  lat: number;
  lng: number;
  osmId: string;
  linework: { type: "MultiLineString"; coordinates: number[][][] } | null;
};

/** Retain linework so PostGIS can assemble split relation members and inner rings. */
export function parseOsmAreas(raw: unknown, bounds: Bounds): OsmArea[] {
  const payload = z
    .object({ elements: z.array(z.unknown()), remark: z.string().optional() })
    .parse(raw);
  if (payload.remark) throw new Error(`Overpass: ${payload.remark}`);
  const inside = (lat: number, lng: number) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lng >= bounds[0] &&
    lat >= bounds[1] &&
    lng <= bounds[2] &&
    lat <= bounds[3];
  return payload.elements.flatMap((rawElement) => {
    const parsed = element.safeParse(rawElement);
    if (!parsed.success) return [];
    const e = parsed.data;
    const name = (e.tags["name:en"] ?? e.tags.name)?.trim();
    if (!name || name.length > 120 || !slugify(name) || !areaKey(name)) return [];
    const members = e.members?.filter(
      (m) => m.type === "way" && (m.role === "outer" || m.role === "inner" || !m.role),
    );
    const lines =
      e.type === "way" ? [e.geometry ?? []] : (members?.map((m) => m.geometry ?? []) ?? []);
    const validLines =
      lines.length > 0 &&
      lines.every((l) => l.length >= 2) &&
      lines.reduce((n, l) => n + l.length, 0) <= 40000;
    const pts = validLines ? lines.flat() : [];
    const lat =
      e.lat ??
      e.center?.lat ??
      (pts.length
        ? (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2
        : NaN);
    const lng =
      e.lon ??
      e.center?.lon ??
      (pts.length
        ? (Math.min(...pts.map((p) => p.lon)) + Math.max(...pts.map((p) => p.lon))) / 2
        : NaN);
    if (!inside(lat, lng)) return [];
    return [
      {
        name,
        key: areaKey(name),
        slug: slugify(name),
        lat,
        lng,
        osmId: `${e.type}/${e.id}`,
        linework: validLines
          ? {
              type: "MultiLineString" as const,
              coordinates: lines.map((l) => l.map((p) => [p.lon, p.lat])),
            }
          : null,
      },
    ];
  });
}

/** A city import is atomic; missing geometry never erases a known boundary. */
export async function saveOsmAreas(db: Db, cityId: number, features: OsmArea[]) {
  let boundaries = 0;
  await db.transaction(async (tx) => {
    for (const f of features) {
      const [row] = await tx.execute<{ has_boundary: boolean }>(sql`
        with shape as (select ST_BuildArea(ST_GeomFromGeoJSON(${f.linework ? JSON.stringify(f.linework) : null})) geom),
        valid as (select case when ST_IsValid(geom) and not ST_IsEmpty(geom) then geom end boundary from shape)
        insert into areas (city_id,name,key,slug,lat,lng,weight,source,osm_id,boundary)
        select ${cityId},${f.name},${f.key},${f.slug},
          coalesce(ST_Y(ST_PointOnSurface(boundary)),${f.lat}),
          coalesce(ST_X(ST_PointOnSurface(boundary)),${f.lng}),0,'osm',${f.osmId},boundary from valid
        on conflict (city_id,slug) do update set
          boundary = coalesce(excluded.boundary,areas.boundary),
          osm_id = case when excluded.boundary is not null or areas.boundary is null then excluded.osm_id else areas.osm_id end,
          lat = case when areas.source = 'manual' then areas.lat else excluded.lat end,
          lng = case when areas.source = 'manual' then areas.lng else excluded.lng end,
          source = case when areas.source = 'manual' then areas.source else 'osm' end
        returning boundary is not null as has_boundary`);
      if (row.has_boundary) boundaries++;
    }
  });
  return { areas: features.length, boundaries };
}

/** Sequential requests to the public Overpass service, restricted to our catalog's city extents. */
export async function importOsmAreas(db: Db, onlyCity?: string) {
  if (onlyCity && !CITIES.some((c) => c.slug === onlyCity)) throw new Error("Unknown city");
  const userAgent = process.env.NOMINATIM_USER_AGENT;
  if (!userAgent) throw new Error("NOMINATIM_USER_AGENT must include a contact address");
  const summary: { city: string; areas?: number; boundaries?: number; error?: string }[] = [];
  for (const city of CITIES.filter((c) => !onlyCity || c.slug === onlyCity)) {
    try {
      const [extent] = await db.execute<{
        id: number;
        w: number;
        s: number;
        e: number;
        n: number;
      }>(sql`
        select c.id, min(p.lng)-0.1 w,min(p.lat)-0.1 s,max(p.lng)+0.1 e,max(p.lat)+0.1 n
        from cities c join places p on p.city_id=c.id
        where c.slug=${city.slug} and p.lat between 6 and 37 and p.lng between 68 and 98 group by c.id`);
      if (!extent || extent.e - extent.w > 3 || extent.n - extent.s > 3)
        throw new Error("No safe city extent in catalog");
      const bounds: Bounds = [extent.w, extent.s, extent.e, extent.n];
      const box = `${extent.s},${extent.w},${extent.n},${extent.e}`;
      const query = `[out:json][timeout:60];(nwr["place"~"^(neighbourhood|quarter|suburb)$"](${box});wr["boundary"="administrative"]["admin_level"~"^(9|10|11)$"](${box}););out body geom;`;
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(90000),
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > 20_000_000) throw new Error("Overpass response exceeds 20 MB");
      summary.push({
        city: city.slug,
        ...(await saveOsmAreas(db, extent.id, parseOsmAreas(JSON.parse(body), bounds))),
      });
    } catch (error) {
      summary.push({
        city: city.slug,
        error: error instanceof Error ? error.message : "Import failed",
      });
    }
  }
  return summary;
}
