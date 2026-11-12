import { eq, sql, type SQL } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { ACCEPT, areaKey, matchAreas } from "../areas";
import { CITIES } from "../cities";
import { parseDiet, type DietFilter } from "../diet";
import { getPlaceCards, type PickCard } from "./queries";
import { searchAll } from "./search";

export type Bounds = [number, number, number, number];
export type MapFilter = { dish?: string; diet?: DietFilter; area?: string };
export type FoodWalk = {
  slug: string;
  name: string;
  citySlug: string;
  cityName: string;
  meters: number;
  updatedAt: Date;
  stops: PickCard[];
};

export async function getWalks(db: Db, city?: string, slug?: string): Promise<FoodWalk[]> {
  const rows = await db.execute<{
    slug: string;
    name: string;
    citySlug: string;
    cityName: string;
    meters: number;
    updatedAt: Date;
    stopIds: number[];
  }>(sql`
    select w.slug,w.name,w.meters,w.updated_at as "updatedAt",w.stop_ids as "stopIds",ci.slug as "citySlug",ci.name as "cityName"
    from food_walks w join cities ci on ci.id=w.city_id where ${city ? sql`ci.slug=${city}` : sql`true`}
    ${slug ? sql`and w.slug=${slug}` : sql``} and jsonb_array_length(w.stop_ids) between 4 and 5
    and not exists (select 1 from jsonb_array_elements_text(w.stop_ids) stop(id) where not exists (
      select 1 from places p where p.id=stop.id::int and p.city_id=w.city_id and p.status='open'
      and p.geom is not null and p.osm_id is not null and p.osm_id not like 'approx:%'
      and exists (select 1 from recommendations r join sources s on s.id=r.source_id join creators c on c.id=s.creator_id
        where r.place_id=p.id and r.status='approved' and c.opted_out=false))) order by w.slug`);
  const ids = [...new Set(rows.flatMap((r) => r.stopIds))];
  if (ids.length === 0) return [];
  const places = await db.execute<{ id: number; slug: string }>(
    sql`select id,slug from places where id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`,`,
    )})`,
  );
  const byId = new Map(places.map((p) => [p.id, p.slug]));
  const cards = await getPlaceCards(
    db,
    places.map((p) => p.slug),
  );
  const bySlug = new Map(cards.map((p) => [p.placeSlug, p]));
  const out: FoodWalk[] = [];
  for (const row of rows) {
    const stops = row.stopIds.flatMap((id) => {
      const card = bySlug.get(byId.get(id)!);
      return card ? [card] : [];
    });
    if (stops.length === row.stopIds.length) out.push({ ...row, stops });
  }
  return out;
}

export async function getHeatmap(db: Db, city: string) {
  const rows = await db.execute<{
    cell: string;
    count: number;
    geometry: { type: string; coordinates: unknown };
    updated_at: Date;
  }>(sql`
    select h.cell,sum(h.count)::int count,(array_agg(h.geometry))[1] geometry,max(h.updated_at) updated_at
    from heat_cells h join creators c on c.id=h.creator_id join cities ci on ci.id=h.city_id
    where ci.slug=${city} and c.opted_out=false group by h.cell order by h.cell`);
  return {
    type: "FeatureCollection" as const,
    features: rows.map((r) => ({
      type: "Feature" as const,
      id: r.cell,
      geometry: r.geometry,
      properties: { count: r.count, updatedAt: r.updated_at },
    })),
  };
}
export type Area = {
  id: number;
  citySlug: string;
  cityName: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  hasBoundary: boolean;
  osmId: string | null;
};

export function parseBounds(raw: string | null): Bounds | null {
  const parts = raw?.split(",");
  if (!parts || parts.length !== 4 || parts.some((v) => !v.trim())) return null;
  const [w, s, e, n] = parts.map(Number);
  if (
    ![w, s, e, n].every(Number.isFinite) ||
    w < -180 ||
    e > 180 ||
    s < -90 ||
    n > 90 ||
    w >= e ||
    s >= n
  )
    return null;
  return [w, s, e, n];
}

export function readMapFilter(params: URLSearchParams): MapFilter | null {
  const dish = params.get("dish"),
    area = params.get("area"),
    diet = params.get("diet");
  if (
    [dish, area].some((v) => v !== null && !/^[\p{L}\p{N}-]{1,120}$/u.test(v)) ||
    (diet !== null && !parseDiet(diet))
  )
    return null;
  return { ...(dish && { dish }), ...(area && { area }), ...(diet && { diet: parseDiet(diet) }) };
}

export function parseTileCoordinates(
  z: string,
  x: string,
  y: string,
): [number, number, number] | null {
  if (![z, x, y].every((v) => /^\d{1,6}$/.test(v))) return null;
  const [zoom, col, row] = [z, x, y].map(Number);
  return zoom <= 18 && col < 2 ** zoom && row < 2 ** zoom ? [zoom, col, row] : null;
}

/** Filter in geography first so the GiST index limits work before projection and MVT encoding. */
export async function pickTile(
  db: Db,
  city: string,
  [z, x, y]: [number, number, number],
  filter: MapFilter,
): Promise<Uint8Array> {
  if (
    !CITIES.some((c) => c.slug === city) ||
    !parseTileCoordinates(String(z), String(x), String(y))
  )
    throw new Error("Invalid tile");
  const envelope = sql`ST_TileEnvelope(${z},${x},${y})`;
  // Whole-world/hemisphere polygons cannot be cast safely to geography (antipodal edges).
  const boundsFilter =
    z < 2
      ? sql`true`
      : sql`p.geom && ST_Transform(ST_Intersection(
    ST_TileEnvelope(${z},${x},${y},margin=>64.0/4096),ST_TileEnvelope(0,0,0)),4326)::geography`;
  const [row] = await db.execute<{ tile: Uint8Array }>(sql`
    select ST_AsMVT(tile_rows,'picks',4096,'geom','id') as tile from (
      select p.id,p.slug,p.name,coalesce(p.osm_id like 'approx:%',false) approx,
        ST_AsMVTGeom(ST_Transform(p.geom::geometry,3857),${envelope},4096,64,true) geom
      from places p join cities ci on ci.id=p.city_id
      where ci.slug=${city} and ${boundsFilter}
      and exists (select 1 from recommendations r join sources s on s.id=r.source_id
        join creators c on c.id=s.creator_id join dishes d on d.id=r.dish_id
        where r.place_id=p.id and ${visible}
        ${filter.dish ? sql`and d.slug=${filter.dish}` : sql``}
        ${filter.diet ? sql`and d.diet=${filter.diet}` : sql``})
      ${filter.area ? sql`and exists(select 1 from areas a where a.city_id=p.city_id and a.slug=${filter.area} and ${areaContains})` : sql``}
    ) tile_rows`);
  return row.tile;
}

const areaFields = sql`a.id, a.slug, a.name, a.lat, a.lng, a.osm_id as "osmId",
  a.boundary is not null as "hasBoundary", ci.slug as "citySlug", ci.name as "cityName"`;
const areaContains = sql`case when a.boundary is not null
  then ST_Covers(a.boundary,p.geom::geometry)
  else ST_DWithin(p.geom,ST_SetSRID(ST_MakePoint(a.lng,a.lat),4326)::geography,1000) end`;
// Every query using this aliases `places` as p, so closed places never reach a map, area or walk.
const visible = sql`r.status='approved' and c.opted_out=false and p.status<>'closed'`;

export async function getArea(db: Db, city: string, slug: string): Promise<Area | null> {
  const [row] = await db.execute<Area>(sql`select ${areaFields} from areas a
    join cities ci on ci.id=a.city_id where ci.slug=${city} and a.slug=${slug}`);
  return row ?? null;
}

/** Navigation and sitemap show only areas with visible picks. */
export async function listAreas(db: Db, city?: string): Promise<Area[]> {
  return Array.from(
    await db.execute<Area>(sql`select ${areaFields} from areas a join cities ci on ci.id=a.city_id
    where ${city ? sql`ci.slug=${city}` : sql`true`} and exists (
      select 1 from places p join recommendations r on r.place_id=p.id
      join sources s on s.id=r.source_id join creators c on c.id=s.creator_id
      where p.city_id=a.city_id and ${visible} and ${areaContains})
    order by ci.slug,a.name limit 500`),
  );
}

export async function getSpatialPicks(
  db: Db,
  city: string,
  options: {
    bbox?: Bounds;
    area?: string;
    near?: { lat: number; lng: number };
    dishes?: string[];
    diet?: DietFilter;
  } = {},
): Promise<PickCard[]> {
  if (!CITIES.some((c) => c.slug === city) || options.dishes?.length === 0) return [];
  const filters: SQL[] = [sql`ci.slug=${city}`, visible];
  let distance = sql`null::float8`;
  let order = sql`p.slug`;
  if (options.bbox) {
    const b = parseBounds(options.bbox.join(","));
    if (!b) throw new Error("Invalid bounding box");
    const envelope = sql`ST_MakeEnvelope(${b[0]},${b[1]},${b[2]},${b[3]},4326)`;
    const indexed = b[2] - b[0] < 180 ? sql`p.geom && ${envelope}::geography` : sql`true`;
    filters.push(sql`${indexed} and ST_Covers(${envelope},p.geom::geometry)`);
  }
  if (options.area)
    filters.push(
      sql`exists(select 1 from areas a where a.city_id=p.city_id and a.slug=${options.area} and ${areaContains})`,
    );
  if (options.near) {
    const { lat, lng } = options.near;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      throw new Error("Invalid coordinates");
    const origin = sql`ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography`;
    filters.push(sql`ST_DWithin(p.geom,${origin},2000)`);
    distance = sql`ST_Distance(p.geom,${origin})`;
    order = sql`p.geom <-> ${origin},p.slug`;
  }
  if (options.dishes)
    filters.push(
      sql`d.slug in (${sql.join(
        options.dishes.map((d) => sql`${d}`),
        sql`,`,
      )})`,
    );
  if (options.diet) filters.push(sql`d.diet=${options.diet}`);
  const rows = await db.execute<{ slug: string; meters: number | null }>(sql`
    select p.slug, ${distance} as meters from places p join cities ci on ci.id=p.city_id
    where exists (select 1 from recommendations r join sources s on s.id=r.source_id
      join creators c on c.id=s.creator_id join dishes d on d.id=r.dish_id
      where r.place_id=p.id and ${sql.join(filters, sql` and `)})
    order by ${order} limit 300`);
  const cards = await getPlaceCards(
    db,
    rows.map((r) => r.slug),
    undefined,
    options.diet,
    options.dishes,
  );
  if (!options.near) return cards;
  const meters = new Map(rows.map((r) => [r.slug, Number(r.meters)]));
  return cards
    .map((c) => ({ ...c, distanceM: meters.get(c.placeSlug)! }))
    .sort((a, b) => a.distanceM - b.distanceM || a.placeSlug.localeCompare(b.placeSlug));
}

export type NearAreaResult = {
  area: Area | null;
  dish: string;
  cards: PickCard[];
  error?: string;
  suggestions: { label: string; city: string }[];
};

/** Resolves local names only. Search text never causes an outbound geocoding request. */
export async function nearAreaSearch(
  db: Db,
  raw: string,
  city?: string,
  diet?: DietFilter,
): Promise<NearAreaResult | null> {
  const q = areaKey(raw.slice(0, 100));
  const explicit = q.match(/^(.*?)\s+(?:near|in)\s+(.+)$/);
  let dish = explicit?.[1] ?? "";
  let typedArea = explicit?.[2] ?? "";
  let selectedCity = city;
  for (const c of CITIES) {
    for (const name of [c.name, ...c.aliases].sort((a, b) => b.length - a.length)) {
      const key = areaKey(name);
      for (const suffix of [` in ${key}`, ` ${key}`]) {
        if (typedArea.endsWith(suffix)) {
          if (selectedCity && selectedCity !== c.slug)
            return {
              area: null,
              dish,
              cards: [],
              suggestions: [],
              error: "The area and city filters disagree. Choose one city.",
            };
          selectedCity = c.slug;
          typedArea = typedArea.slice(0, -suffix.length);
        }
      }
    }
  }
  const cities = await db
    .select({ id: schema.cities.id, slug: schema.cities.slug })
    .from(schema.cities)
    .where(selectedCity ? eq(schema.cities.slug, selectedCity) : sql`true`);
  let candidates: { id: number; city: string; score: number; name: string }[] = [];
  if (explicit) {
    candidates = (
      await Promise.all(
        cities.map(async (c) =>
          (await matchAreas(db, c.id, typedArea)).map((a) => ({ ...a, city: c.slug })),
        ),
      )
    )
      .flat()
      .sort((a, b) => b.score - a.score);
  } else {
    const rows = await db.execute<{ id: number; city: string; name: string; key: string }>(sql`
      select a.id,ci.slug city,a.name,a.key from areas a join cities ci on ci.id=a.city_id
      where ${selectedCity ? sql`ci.slug=${selectedCity}` : sql`true`} and right(${q},length(a.key)+1)=' '||a.key
      union all select a.id,ci.slug,a.name,l.key from area_aliases l join areas a on a.id=l.area_id
      join cities ci on ci.id=a.city_id where ${selectedCity ? sql`ci.slug=${selectedCity}` : sql`true`}
      and right(${q},length(l.key)+1)=' '||l.key order by key desc`);
    const longest = [...rows].sort((a, b) => b.key.length - a.key.length)[0];
    if (!longest) return null;
    dish = q.slice(0, -longest.key.length).trim();
    candidates = rows
      .filter((r) => r.key.length === longest.key.length)
      .map((r) => ({ ...r, score: 1 }));
  }
  const matches = candidates.filter((c) => c.score >= ACCEPT);
  if (!matches.length || new Set(matches.map((c) => c.city)).size > 1)
    return {
      area: null,
      dish,
      cards: [],
      error: matches.length
        ? "Choose a city for this area."
        : "Area not found. Try another neighbourhood or choose a city.",
      suggestions: candidates.slice(0, 3).map((c) => ({ label: c.name, city: c.city })),
    };
  const hit = matches[0];
  const [row] = await db.execute<{ slug: string }>(sql`select slug from areas where id=${hit.id}`);
  const area = await getArea(db, hit.city, row.slug);
  const found = await searchAll(db, dish);
  const dishes = [
    ...new Set(found.dishes.filter((d) => d.citySlug === hit.city).map((d) => d.slug)),
  ];
  const cards = area ? await getSpatialPicks(db, hit.city, { near: area, dishes, diet }) : [];
  return { area, dish, cards, suggestions: [] };
}
