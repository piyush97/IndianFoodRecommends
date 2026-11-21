import { and, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { schema, type Db } from "../../db";
import type { Platform } from "./links";
import { CITIES } from "../cities";
import { compareCards, rankScore } from "./rank";
import type { DietFilter } from "../diet";
import { nearbyPlaces } from "../geo";
import { flaggedPlaces } from "../trust";

/** A place near another one; `meters` is null when either pin is only neighbourhood-level. */
export type NearbyCard = PickCard & { meters: number | null };

export type PickCard = {
  citySlug: string;
  placeSlug: string;
  placeName: string;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  approx: boolean;
  creators: { slug: string; name: string; avatarUrl: string | null }[];
  dishes: string[];
  /** Distinct videos that picked this place. */
  videos: number;
  proof: { platform: Platform; externalId: string; tsSeconds: number | null; creator: string };
  score: number;
  /** Newest pick date for this place, YYYY-MM-DD. */
  pickedOn: string;
  /** Straight-line distance from an area search; approximate pins remain labelled. */
  distanceM?: number;
  /** "closed" only reaches a card on an eat list; every other path filters closed places out. */
  status: PlaceStatus;
  /** When an admin last changed `status`, ISO 8601. */
  statusChangedAt: string | null;
  /** Three or more distinct visitors reported it closed or moved and nobody has resolved that yet. */
  flagged: boolean;
  /** What the flagging reports say: "moved" only when every one of them says moved. */
  flagKind?: "closed" | "moved";
};

export type PlaceStatus = "open" | "closed" | "moved";

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
  creatorAvatarUrl: string | null;
  placeSlug: string;
  placeName: string;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  osmId: string | null;
  googlePlaceId: string | null;
  lastVerified: string | null;
  status: PlaceStatus;
  statusChangedAt: Date | null;
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

const dietWhere = (diet?: DietFilter): SQL[] => (diet ? [eq(schema.dishes.diet, diet)] : []);

/** Closed places are hidden unless `includeClosed`: only a place page and a shared list still show them. */
async function visibleRows(
  db: Db,
  opts: { includeClosed?: boolean },
  ...filters: SQL[]
): Promise<Row[]> {
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
      creatorAvatarUrl: c.avatarUrl,
      placeSlug: p.slug,
      placeName: p.name,
      locality: p.locality,
      lat: p.lat,
      lng: p.lng,
      osmId: p.osmId,
      googlePlaceId: p.googlePlaceId,
      lastVerified: p.lastVerified,
      status: p.status,
      statusChangedAt: p.statusChangedAt,
      dishSlug: d.slug,
      dishName: d.name,
    })
    .from(r)
    .innerJoin(s, eq(s.id, r.sourceId))
    .innerJoin(c, eq(c.id, s.creatorId))
    .innerJoin(p, eq(p.id, r.placeId))
    .innerJoin(d, eq(d.id, r.dishId))
    .innerJoin(schema.cities, eq(schema.cities.id, p.cityId))
    .where(
      and(
        eq(r.status, "approved"),
        eq(c.optedOut, false),
        opts.includeClosed ? undefined : ne(p.status, "closed"),
        ...filters,
      ),
    )
    .orderBy(r.id);
}

function pickedAt(row: Row): Date {
  return row.publishedOn ? new Date(`${row.publishedOn}T00:00:00Z`) : row.createdAt;
}

/** Groups rows by place, ranked by `compareCards`. `flags` comes from one `flaggedPlaces` call. */
function toCards(
  rows: Row[],
  now: Date,
  flags: Map<number, "closed" | "moved"> = new Map(),
): PickCard[] {
  const byPlace = new Map<string, Row[]>();
  for (const row of rows) byPlace.set(row.placeSlug, [...(byPlace.get(row.placeSlug) ?? []), row]);

  const cards = [...byPlace.values()].map((group): PickCard => {
    const first = group[0];
    const creators = new Map(
      group.map((g) => [
        g.creatorSlug,
        { slug: g.creatorSlug, name: g.creatorName, avatarUrl: g.creatorAvatarUrl },
      ]),
    );
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
      creators: [...creators.values()],
      dishes: [...new Set(group.map((g) => g.dishName))],
      videos: new Set(group.map((g) => g.externalId)).size,
      proof: {
        platform: proof.platform,
        externalId: proof.externalId,
        tsSeconds: proof.tsSeconds,
        creator: proof.creatorName,
      },
      score: rankScore(creators.size, newest, now),
      pickedOn: newest.toISOString().slice(0, 10),
      status: first.status,
      statusChangedAt: first.statusChangedAt?.toISOString() ?? null,
      flagged: flags.has(first.placeId),
      ...(flags.has(first.placeId) && { flagKind: flags.get(first.placeId) }),
    };
  });
  return cards.sort(compareCards);
}

/** `toCards` with visitor flags for every place in `rows`, read in a single query. */
async function cardsWithFlags(db: Db, rows: Row[], now: Date): Promise<PickCard[]> {
  const flags = await flaggedPlaces(db, [...new Set(rows.map((r) => r.placeId))], now);
  return toCards(rows, now, flags);
}

function countBy<K extends string>(rows: Row[], key: (r: Row) => K) {
  const counts = new Map<K, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return counts;
}

/** Cities with at least one visible pick, in registry order. */
export async function listActiveCities(db: Db) {
  const r = schema.recommendations;
  const s = schema.sources;
  const c = schema.creators;
  const p = schema.places;
  const d = schema.dishes;
  // This repeats the visibleRows filter so the whole count is one aggregate; change both together.
  const rows = await db
    .select({
      slug: schema.cities.slug,
      name: schema.cities.name,
      picks: sql<number>`count(*)::int`,
    })
    .from(r)
    .innerJoin(s, eq(s.id, r.sourceId))
    .innerJoin(c, eq(c.id, s.creatorId))
    .innerJoin(p, eq(p.id, r.placeId))
    .innerJoin(d, eq(d.id, r.dishId))
    .innerJoin(schema.cities, eq(schema.cities.id, p.cityId))
    .where(and(eq(r.status, "approved"), eq(c.optedOut, false), ne(p.status, "closed")))
    .groupBy(schema.cities.slug, schema.cities.name);
  const order = CITIES.map((c) => c.slug);
  return rows.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
}

/** One load for the home and city pages: both need the same rows and the full ranking. */
async function cityPicks(db: Db, citySlug: string, now: Date, diet?: DietFilter) {
  const city = await findCity(db, citySlug);
  if (!city) return null;
  const rows = await visibleRows(db, {}, eq(schema.places.cityId, city.id), ...dietWhere(diet));

  const dishNames = new Map(rows.map((r) => [r.dishSlug, r.dishName]));
  const creatorDetails = new Map(
    rows.map((r) => [
      r.creatorSlug,
      { slug: r.creatorSlug, name: r.creatorName, avatarUrl: r.creatorAvatarUrl },
    ]),
  );
  const dishes = [...countBy(rows, (r) => r.dishSlug)]
    .map(([slug, picks]) => ({ slug, name: dishNames.get(slug)!, picks }))
    .sort((a, b) => b.picks - a.picks || a.name.localeCompare(b.name));
  const creators = [...countBy(rows, (r) => r.creatorSlug)]
    .map(([slug, picks]) => ({ ...creatorDetails.get(slug)!, picks }))
    .sort((a, b) => b.picks - a.picks || a.name.localeCompare(b.name));

  const latestFirst = [...rows].sort(
    (a, b) => (b.reviewedAt ?? b.createdAt).getTime() - (a.reviewedAt ?? a.createdAt).getTime(),
  );
  const recentPlaces = [...new Set(latestFirst.map((r) => r.placeSlug))].slice(0, 6);
  const ranked = await cardsWithFlags(db, rows, now);
  const cards = new Map(ranked.map((c) => [c.placeSlug, c]));
  const recent = recentPlaces.map((slug) => cards.get(slug)!);

  return {
    city: { slug: city.slug, name: city.name },
    dishes,
    creators,
    recent,
    ranked,
  };
}

export async function getHome(db: Db, citySlug: string, now = new Date(), diet?: DietFilter) {
  const picks = await cityPicks(db, citySlug, now, diet);
  if (!picks) return null;
  const { ranked, ...home } = picks;
  return { ...home, top: ranked.slice(0, 6), agreeCount: ranked.filter(isAgreed).length };
}

/** Headline for `/[city]/agree`; `n` is the live count of agreed places. */
export function agreeTitle(n: number, city: string): string {
  return `${n} ${city} ${n === 1 ? "place" : "places"} that more than one food creator recommends`;
}

/** A place two or more distinct creators picked. */
export const isAgreed = (card: PickCard) => card.creators.length >= 2;

export type AgreeCreator = PickCard["creators"][number] & {
  picks: { dish: string; platform: Platform; externalId: string; tsSeconds: number | null }[];
};

/** Places in a city that 2+ distinct creators picked: most creators first, then `compareCards`. */
export async function getAgree(db: Db, citySlug: string, now = new Date()) {
  const city = await findCity(db, citySlug);
  if (!city) return null;
  const all = await visibleRows(db, {}, eq(schema.places.cityId, city.id));
  const creatorsAt = new Map<string, Set<string>>();
  for (const r of all)
    creatorsAt.set(r.placeSlug, (creatorsAt.get(r.placeSlug) ?? new Set()).add(r.creatorSlug));
  const rows = all.filter((r) => creatorsAt.get(r.placeSlug)!.size >= 2);
  const cards = (await cardsWithFlags(db, rows, now)).sort(
    (a, b) => b.creators.length - a.creators.length || compareCards(a, b),
  );
  const places = cards.map((card) => ({
    ...card,
    creators: card.creators.map((c): AgreeCreator => {
      const mine = rows.filter((r) => r.placeSlug === card.placeSlug && r.creatorSlug === c.slug);
      const picks = new Map(
        mine.map((r) => [
          `${r.externalId}|${r.dishName}`,
          {
            dish: r.dishName,
            platform: r.platform,
            externalId: r.externalId,
            tsSeconds: r.tsSeconds,
          },
        ]),
      );
      return { ...c, picks: [...picks.values()] };
    }),
  }));
  return { city: { slug: city.slug, name: city.name }, places };
}

export async function getCity(db: Db, citySlug: string, now = new Date(), diet?: DietFilter) {
  const picks = await cityPicks(db, citySlug, now, diet);
  if (!picks) return null;
  return { city: picks.city, dishes: picks.dishes, places: picks.ranked };
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
    {},
    eq(schema.places.cityId, city.id),
    eq(schema.dishes.slug, dishSlug),
  );
  return {
    city: { slug: city.slug, name: city.name },
    dish,
    places: await cardsWithFlags(db, rows, now),
    creatorCount: new Set(rows.map((r) => r.creatorSlug)).size,
  };
}

/**
 * Places picked for any of these dishes (search merges "Chole Bhature" with
 * "Desi Ghee Chole Bhature"), ranked by distinct creators across them.
 */
export async function getDishPicks(
  db: Db,
  dishSlugs: string[],
  now = new Date(),
  diet?: DietFilter,
) {
  if (dishSlugs.length === 0) return [];
  return cardsWithFlags(
    db,
    await visibleRows(db, {}, inArray(schema.dishes.slug, dishSlugs), ...dietWhere(diet)),
    now,
  );
}

/** Ranked cards for the given places (any city); hidden or unknown slugs drop out. */
export async function getPlaceCards(
  db: Db,
  placeSlugs: string[],
  now = new Date(),
  diet?: DietFilter,
  dishSlugs?: string[],
) {
  if (placeSlugs.length === 0) return [];
  const rows = await visibleRows(
    db,
    {},
    inArray(schema.places.slug, placeSlugs),
    ...dietWhere(diet),
    ...(dishSlugs ? [inArray(schema.dishes.slug, dishSlugs)] : []),
  );
  return cardsWithFlags(db, rows, now);
}

/** Every visible place as a card, for the on-device near-me index. */
export async function getAllCards(db: Db, now: Date = new Date()): Promise<PickCard[]> {
  return cardsWithFlags(db, await visibleRows(db, {}), now);
}

/**
 * Shared-list cards in the order of `slugs`. Unknown, unapproved and opted-out places are simply
 * absent. A place closed after it was saved or shared stays, labelled closed.
 */
export async function getListCards(
  db: Db,
  slugs: string[],
  now: Date = new Date(),
): Promise<PickCard[]> {
  const wanted = [...new Set(slugs)].slice(0, 30);
  if (wanted.length === 0) return [];
  const rows = await visibleRows(db, { includeClosed: true }, inArray(schema.places.slug, wanted));
  return (await cardsWithFlags(db, rows, now)).sort(
    (a, b) => wanted.indexOf(a.placeSlug) - wanted.indexOf(b.placeSlug),
  );
}

/** Other places with approved picks within 1.5 km of a pin, nearest first. */
async function nearbyCards(
  db: Db,
  place: { slug: string; lat: number | null; lng: number | null; approx: boolean },
  now: Date,
): Promise<NearbyCard[]> {
  if (place.lat === null || place.lng === null) return [];
  const near = await nearbyPlaces(db, {
    lat: place.lat,
    lng: place.lng,
    radiusKm: 1.5,
    limit: 8,
    exceptSlug: place.slug,
  });
  const cards = await getPlaceCards(
    db,
    near.map((n) => n.slug),
    now,
  );
  const metres = new Map(near.map((n) => [n.slug, n.meters]));
  return (
    cards
      .map((card): NearbyCard => {
        // A neighbourhood-level pin has no real distance, so show none.
        const m = place.approx || card.approx ? null : Math.round(metres.get(card.placeSlug) ?? 0);
        return { ...card, meters: m };
      })
      // Pins in one neighbourhood share a point, so there the picks decide; elsewhere distance does.
      .sort(
        (a, b) =>
          (metres.get(a.placeSlug) ?? 0) - (metres.get(b.placeSlug) ?? 0) || b.score - a.score,
      )
      .slice(0, 5)
  );
}

export async function getPlace(db: Db, citySlug: string, placeSlug: string, now = new Date()) {
  const city = await findCity(db, citySlug);
  if (!city) return null;
  // Direct links and shared pages keep working after a place closes, so this one includes closed.
  const rows = await visibleRows(
    db,
    { includeClosed: true },
    eq(schema.places.cityId, city.id),
    eq(schema.places.slug, placeSlug),
  );
  if (rows.length === 0) return null;
  const first = rows[0];
  const flags = await flaggedPlaces(db, [first.placeId], now);
  // Kept out of visibleRows: only this page needs the schedule, and list queries should not carry it.
  const [hours] = await db
    .select({ openingWeek: schema.places.openingWeek })
    .from(schema.places)
    .where(eq(schema.places.id, first.placeId));
  const newest = new Date(Math.max(...rows.map((r) => pickedAt(r).getTime())));

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
      status: first.status,
      statusChangedAt: first.statusChangedAt?.toISOString() ?? null,
      flagged: flags.has(first.placeId),
      flagKind: flags.get(first.placeId),
      pickedOn: newest.toISOString().slice(0, 10),
      // "none" marks a lookup that found no confident match.
      googlePlaceId: first.googlePlaceId === "none" ? null : first.googlePlaceId,
      openingWeek: hours?.openingWeek ?? null,
    },
    nearby: await nearbyCards(
      db,
      {
        slug: first.placeSlug,
        lat: first.lat,
        lng: first.lng,
        approx: first.osmId?.startsWith("approx:") ?? false,
      },
      now,
    ),
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

/** Public creators with at least one visible pick, most picks first, then by name. */
export async function listCreators(db: Db) {
  const r = schema.recommendations;
  const s = schema.sources;
  const c = schema.creators;
  const p = schema.places;
  const rows = await db
    .select({
      slug: c.slug,
      name: c.name,
      avatarUrl: c.avatarUrl,
      picks: sql<number>`count(*)::int`,
    })
    .from(r)
    .innerJoin(s, eq(s.id, r.sourceId))
    .innerJoin(c, eq(c.id, s.creatorId))
    .innerJoin(p, eq(p.id, r.placeId))
    .where(and(eq(r.status, "approved"), eq(c.optedOut, false), ne(p.status, "closed")))
    .groupBy(c.slug, c.name, c.avatarUrl);
  return rows.sort((a, b) => b.picks - a.picks || a.name.localeCompare(b.name));
}

export async function getCreator(db: Db, slug: string, dishSlug?: string, now = new Date()) {
  const [creator] = await db
    .select({
      slug: schema.creators.slug,
      name: schema.creators.name,
      ytChannelId: schema.creators.ytChannelId,
      avatarUrl: schema.creators.avatarUrl,
      igHandle: schema.creators.igHandle,
      optedOut: schema.creators.optedOut,
    })
    .from(schema.creators)
    .where(eq(schema.creators.slug, slug));
  if (!creator || creator.optedOut) return null;

  const rows = await visibleRows(db, {}, eq(schema.creators.slug, slug));
  const dishes = [...new Map(rows.map((r) => [r.dishSlug, r.dishName]))]
    .map(([s, name]) => ({ slug: s, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = dishSlug ? rows.filter((r) => r.dishSlug === dishSlug) : rows;

  return {
    creator: {
      slug: creator.slug,
      name: creator.name,
      ytChannelId: creator.ytChannelId,
      avatarUrl: creator.avatarUrl,
      igHandle: creator.igHandle,
    },
    dishes,
    picks: await cardsWithFlags(db, shown, now),
    total: rows.length,
  };
}
