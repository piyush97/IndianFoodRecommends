import { and, eq, inArray, type SQL } from "drizzle-orm";
import { schema, type Db } from "../../db";
import type { Platform } from "./links";
import { CITIES } from "../cities";
import { rankScore } from "./rank";

export type PickCard = {
  citySlug: string;
  placeSlug: string;
  placeName: string;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  approx: boolean;
  creators: { slug: string; name: string }[];
  dishes: string[];
  proof: { platform: Platform; externalId: string; tsSeconds: number | null; creator: string };
  score: number;
};

type City = { slug: string; name: string };

/** One visible pick: approved, from a creator who has not opted out. */
type Row = {
  recId: number;
  placeId: number;
  tsSeconds: number | null;
  note: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  platform: Platform;
  externalId: string;
  publishedOn: string | null;
  citySlug: string;
  creatorSlug: string;
  creatorName: string;
  placeSlug: string;
  placeName: string;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  osmId: string | null;
  lastVerified: string | null;
  dishSlug: string;
  dishName: string;
};

async function findCity(db: Db, slug: string): Promise<(City & { id: number }) | null> {
  const [city] = await db
    .select({ id: schema.cities.id, slug: schema.cities.slug, name: schema.cities.name })
    .from(schema.cities)
    .where(eq(schema.cities.slug, slug));
  return city ?? null;
}

async function visibleRows(db: Db, ...filters: SQL[]): Promise<Row[]> {
  const r = schema.recommendations;
  const s = schema.sources;
  const c = schema.creators;
  const p = schema.places;
  const d = schema.dishes;
  return db
    .select({
      recId: r.id,
      placeId: p.id,
      tsSeconds: r.tsSeconds,
      note: r.note,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
      platform: s.platform,
      externalId: s.externalId,
      publishedOn: s.publishedOn,
      citySlug: schema.cities.slug,
      creatorSlug: c.slug,
      creatorName: c.name,
      placeSlug: p.slug,
      placeName: p.name,
      locality: p.locality,
      lat: p.lat,
      lng: p.lng,
      osmId: p.osmId,
      lastVerified: p.lastVerified,
      dishSlug: d.slug,
      dishName: d.name,
    })
    .from(r)
    .innerJoin(s, eq(s.id, r.sourceId))
    .innerJoin(c, eq(c.id, s.creatorId))
    .innerJoin(p, eq(p.id, r.placeId))
    .innerJoin(d, eq(d.id, r.dishId))
    .innerJoin(schema.cities, eq(schema.cities.id, p.cityId))
    .where(and(eq(r.status, "approved"), eq(c.optedOut, false), ...filters))
    .orderBy(r.id);
}

function pickedAt(row: Row): Date {
  return row.publishedOn ? new Date(`${row.publishedOn}T00:00:00Z`) : row.createdAt;
}

/** Groups rows by place, ranked by distinct creators then recency. */
function toCards(rows: Row[], now: Date): PickCard[] {
  const byPlace = new Map<string, Row[]>();
  for (const row of rows) byPlace.set(row.placeSlug, [...(byPlace.get(row.placeSlug) ?? []), row]);

  const cards = [...byPlace.values()].map((group): PickCard => {
    const first = group[0];
    const creators = new Map(group.map((g) => [g.creatorSlug, g.creatorName]));
    const newest = new Date(Math.max(...group.map((g) => pickedAt(g).getTime())));
    const proof = group.find((g) => g.tsSeconds !== null) ?? first;
    return {
      citySlug: first.citySlug,
      placeSlug: first.placeSlug,
      placeName: first.placeName,
      locality: first.locality,
      lat: first.lat,
      lng: first.lng,
      approx: first.osmId?.startsWith("approx:") ?? false,
      creators: [...creators].map(([slug, name]) => ({ slug, name })),
      dishes: [...new Set(group.map((g) => g.dishName))],
      proof: {
        platform: proof.platform,
        externalId: proof.externalId,
        tsSeconds: proof.tsSeconds,
        creator: proof.creatorName,
      },
      score: rankScore(creators.size, newest, now),
    };
  });
  return cards.sort((a, b) => b.score - a.score || a.placeName.localeCompare(b.placeName));
}

function countBy<K extends string>(rows: Row[], key: (r: Row) => K) {
  const counts = new Map<K, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return counts;
}

/** Cities with at least one visible pick, in registry order. */
export async function listActiveCities(db: Db) {
  const rows = await visibleRows(db);
  const counts = new Map<string, { slug: string; name: string; picks: number }>();
  for (const r of rows) {
    const entry = counts.get(r.citySlug) ?? { slug: r.citySlug, name: "", picks: 0 };
    entry.picks++;
    counts.set(r.citySlug, entry);
  }
  const names = new Map(
    (
      await db.select({ slug: schema.cities.slug, name: schema.cities.name }).from(schema.cities)
    ).map((c) => [c.slug, c.name] as const),
  );
  const order = CITIES.map((c) => c.slug);
  return [...counts.values()]
    .map((c) => ({ ...c, name: names.get(c.slug) ?? c.slug }))
    .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
}

export async function getHome(db: Db, citySlug: string, now = new Date()) {
  const city = await findCity(db, citySlug);
  if (!city) return null;
  const rows = await visibleRows(db, eq(schema.places.cityId, city.id));

  const dishNames = new Map(rows.map((r) => [r.dishSlug, r.dishName]));
  const creatorNames = new Map(rows.map((r) => [r.creatorSlug, r.creatorName]));
  const dishes = [...countBy(rows, (r) => r.dishSlug)]
    .map(([slug, picks]) => ({ slug, name: dishNames.get(slug)!, picks }))
    .sort((a, b) => b.picks - a.picks || a.name.localeCompare(b.name));
  const creators = [...countBy(rows, (r) => r.creatorSlug)]
    .map(([slug, picks]) => ({ slug, name: creatorNames.get(slug)!, picks }))
    .sort((a, b) => b.picks - a.picks || a.name.localeCompare(b.name));

  const latestFirst = [...rows].sort(
    (a, b) => (b.reviewedAt ?? b.createdAt).getTime() - (a.reviewedAt ?? a.createdAt).getTime(),
  );
  const recentPlaces = [...new Set(latestFirst.map((r) => r.placeSlug))].slice(0, 6);
  const ranked = toCards(rows, now);
  const cards = new Map(ranked.map((c) => [c.placeSlug, c]));
  const recent = recentPlaces.map((slug) => cards.get(slug)!);

  return {
    city: { slug: city.slug, name: city.name },
    dishes,
    creators,
    recent,
    top: ranked.slice(0, 6),
  };
}

export async function getCity(db: Db, citySlug: string, now = new Date()) {
  const home = await getHome(db, citySlug, now);
  if (!home) return null;
  const city = (await findCity(db, citySlug))!;
  const rows = await visibleRows(db, eq(schema.places.cityId, city.id));
  return { city: home.city, dishes: home.dishes, places: toCards(rows, now) };
}

export async function getDishInCity(db: Db, citySlug: string, dishSlug: string, now = new Date()) {
  const city = await findCity(db, citySlug);
  if (!city) return null;
  const [dish] = await db
    .select({ slug: schema.dishes.slug, name: schema.dishes.name })
    .from(schema.dishes)
    .where(eq(schema.dishes.slug, dishSlug));
  if (!dish) return null;
  const rows = await visibleRows(
    db,
    eq(schema.places.cityId, city.id),
    eq(schema.dishes.slug, dishSlug),
  );
  return {
    city: { slug: city.slug, name: city.name },
    dish,
    places: toCards(rows, now),
    creatorCount: new Set(rows.map((r) => r.creatorSlug)).size,
  };
}

/** Ranked cards for the given places (any city); hidden or unknown slugs drop out. */
export async function getPlaceCards(db: Db, placeSlugs: string[], now = new Date()) {
  if (placeSlugs.length === 0) return [];
  const rows = await visibleRows(db, inArray(schema.places.slug, placeSlugs));
  return toCards(rows, now);
}

export async function getPlace(db: Db, citySlug: string, placeSlug: string) {
  const city = await findCity(db, citySlug);
  if (!city) return null;
  const rows = await visibleRows(
    db,
    eq(schema.places.cityId, city.id),
    eq(schema.places.slug, placeSlug),
  );
  if (rows.length === 0) return null;
  const first = rows[0];

  const creatorsPerDish = new Map<string, { slug: string; name: string; creators: Set<string> }>();
  for (const row of rows) {
    const entry = creatorsPerDish.get(row.dishSlug) ?? {
      slug: row.dishSlug,
      name: row.dishName,
      creators: new Set<string>(),
    };
    entry.creators.add(row.creatorSlug);
    creatorsPerDish.set(row.dishSlug, entry);
  }

  return {
    city: { slug: city.slug, name: city.name },
    place: {
      id: first.placeId,
      slug: first.placeSlug,
      name: first.placeName,
      locality: first.locality,
      lat: first.lat,
      lng: first.lng,
      approx: first.osmId?.startsWith("approx:") ?? false,
      lastVerified: first.lastVerified,
    },
    dishes: [...creatorsPerDish.values()]
      .map((d) => ({ slug: d.slug, name: d.name, creators: d.creators.size }))
      .sort((a, b) => b.creators - a.creators || a.name.localeCompare(b.name)),
    proofs: rows.map((r) => ({
      platform: r.platform,
      externalId: r.externalId,
      tsSeconds: r.tsSeconds,
      note: r.note,
      creator: { slug: r.creatorSlug, name: r.creatorName },
      dish: r.dishName,
    })),
  };
}

export async function getCreator(db: Db, slug: string, dishSlug?: string, now = new Date()) {
  const [creator] = await db
    .select({
      slug: schema.creators.slug,
      name: schema.creators.name,
      ytChannelId: schema.creators.ytChannelId,
      igHandle: schema.creators.igHandle,
      optedOut: schema.creators.optedOut,
    })
    .from(schema.creators)
    .where(eq(schema.creators.slug, slug));
  if (!creator || creator.optedOut) return null;

  const rows = await visibleRows(db, eq(schema.creators.slug, slug));
  const dishes = [...new Map(rows.map((r) => [r.dishSlug, r.dishName]))]
    .map(([s, name]) => ({ slug: s, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = dishSlug ? rows.filter((r) => r.dishSlug === dishSlug) : rows;

  return {
    creator: {
      slug: creator.slug,
      name: creator.name,
      ytChannelId: creator.ytChannelId,
      igHandle: creator.igHandle,
    },
    dishes,
    picks: toCards(shown, now),
    total: rows.length,
  };
}
