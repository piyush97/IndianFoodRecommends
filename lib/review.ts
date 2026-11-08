import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { schema, type Db } from "../db";
import { parseSourceUrl } from "./source-url";
import { slugify } from "./text";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const PlaceNew = z.object({
  name: z.string().min(1),
  locality: z.string().nullable().optional(),
  cityId: z.number().int(),
  lat: z.number().min(6).max(37.5),
  lng: z.number().min(68).max(97.5),
});

export const ApproveInput = z.object({
  id: z.number().int(),
  place: z.union([z.object({ existingId: z.number().int() }), PlaceNew]),
  dish: z.union([
    z.object({ existingId: z.number().int() }),
    z.object({ name: z.string().min(1) }),
  ]),
  tsSeconds: z.number().int().min(0).nullable(),
  note: z.string().max(140),
});

export type ApproveInput = z.infer<typeof ApproveInput>;

export async function insertWithSlug(
  tx: Tx,
  fn: (slug: string) => Promise<{ id: number } | undefined>,
  base: string,
): Promise<number> {
  for (let n = 1; n < 50; n++) {
    const row = await fn(n === 1 ? base : `${base}-${n}`);
    if (row) return row.id;
  }
  throw new Error(`could not allocate a slug for ${base}`);
}

export async function approveRecommendation(
  db: Db,
  raw: ApproveInput,
  reviewer: string,
): Promise<void> {
  const input = ApproveInput.parse(raw);
  await db.transaction(async (tx) => {
    const [rec] = await tx
      .select()
      .from(schema.recommendations)
      .where(eq(schema.recommendations.id, input.id))
      .for("update");
    if (!rec) throw new Error(`recommendation ${input.id} not found`);
    if (rec.status !== "pending") throw new Error(`recommendation ${input.id} is not pending`);

    const { placeId, dishId } = await resolvePlaceAndDish(tx, input);

    const today = new Date().toISOString().slice(0, 10);
    await tx
      .update(schema.places)
      .set({ lastVerified: today })
      .where(eq(schema.places.id, placeId));
    await tx
      .update(schema.recommendations)
      .set({
        placeId,
        dishId,
        tsSeconds: input.tsSeconds,
        note: input.note,
        status: "approved",
        reviewedAt: new Date(),
      })
      .where(eq(schema.recommendations.id, input.id));
    void reviewer;
  });
}

type PlaceAndDish = Pick<ApproveInput, "place" | "dish">;

async function resolvePlaceAndDish(
  tx: Tx,
  input: PlaceAndDish,
): Promise<{ placeId: number; dishId: number }> {
  const place = input.place;
  const placeId =
    "existingId" in place
      ? place.existingId
      : await insertWithSlug(
          tx,
          async (slug) => {
            const [row] = await tx
              .insert(schema.places)
              .values({ ...place, slug })
              .onConflictDoNothing()
              .returning();
            return row;
          },
          slugify(place.name),
        );

  const dish = input.dish;
  const dishId =
    "existingId" in dish
      ? dish.existingId
      : await insertWithSlug(
          tx,
          async (slug) => {
            const [row] = await tx
              .insert(schema.dishes)
              .values({ name: dish.name, slug })
              .onConflictDoNothing()
              .returning();
            return row;
          },
          slugify(dish.name),
        );
  return { placeId, dishId };
}

export const ManualInput = ApproveInput.omit({ id: true }).extend({
  url: z.string().max(500),
  creatorId: z.number().int().positive(),
});
export type ManualInput = z.infer<typeof ManualInput>;

/** Editor adds a pick from a YouTube or Instagram URL; it goes live as approved. */
export async function addManualRecommendation(db: Db, raw: ManualInput): Promise<number> {
  const input = ManualInput.parse(raw);
  const ref = parseSourceUrl(input.url);
  if (!ref) throw new Error("URL must be a YouTube video or an Instagram post/reel");

  return db.transaction(async (tx) => {
    await tx
      .insert(schema.sources)
      .values({ ...ref, creatorId: input.creatorId })
      .onConflictDoNothing();
    const [source] = await tx
      .select({ id: schema.sources.id })
      .from(schema.sources)
      .where(
        and(
          eq(schema.sources.platform, ref.platform),
          eq(schema.sources.externalId, ref.externalId),
        ),
      );

    const { placeId, dishId } = await resolvePlaceAndDish(tx, input);
    const [rec] = await tx
      .insert(schema.recommendations)
      .values({
        sourceId: source.id,
        placeId,
        dishId,
        tsSeconds: input.tsSeconds,
        note: input.note,
        status: "approved",
        origin: "manual",
        reviewedAt: new Date(),
      })
      .returning({ id: schema.recommendations.id });
    return rec.id;
  });
}

export async function rejectRecommendation(db: Db, id: number): Promise<void> {
  const rows = await db
    .update(schema.recommendations)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(and(eq(schema.recommendations.id, id), eq(schema.recommendations.status, "pending")))
    .returning({ id: schema.recommendations.id });
  if (rows.length === 0) throw new Error(`recommendation ${id} is not pending`);
}

export async function mergePlaces(db: Db, fromId: number, intoId: number): Promise<void> {
  if (fromId === intoId) throw new Error("cannot merge a place into itself");
  await db.transaction(async (tx) => {
    const [from] = await tx.select().from(schema.places).where(eq(schema.places.id, fromId));
    const [into] = await tx.select().from(schema.places).where(eq(schema.places.id, intoId));
    if (!from || !into) throw new Error("place not found");

    // Drop picks that already exist on the kept place (same source, dish and
    // timestamp); moving them would violate recs_dedupe_uk and abort the merge.
    await tx.execute(sql`
      delete from recommendations f using recommendations i
      where f.place_id = ${fromId} and i.place_id = ${intoId}
        and f.source_id = i.source_id
        and coalesce(f.dish_id, -1) = coalesce(i.dish_id, -1)
        and coalesce(f.ts_seconds, -1) = coalesce(i.ts_seconds, -1)
    `);
    await tx
      .update(schema.recommendations)
      .set({ placeId: intoId })
      .where(eq(schema.recommendations.placeId, fromId));
    // Reports cascade-delete with the place, so move them first.
    await tx
      .update(schema.reports)
      .set({ placeId: intoId })
      .where(eq(schema.reports.placeId, fromId));

    const aliases = await tx
      .select()
      .from(schema.placeAliases)
      .where(eq(schema.placeAliases.placeId, fromId));
    for (const alias of [...aliases.map((a) => a.alias), from.name]) {
      await tx
        .insert(schema.placeAliases)
        .values({ placeId: intoId, alias: alias })
        .onConflictDoNothing();
    }
    await tx.delete(schema.places).where(eq(schema.places.id, fromId));
  });
}

/** Folds a duplicate dish into the one that stays; its name becomes an alias so searches still find it. */
export async function mergeDishes(db: Db, fromId: number, intoId: number): Promise<void> {
  if (fromId === intoId) throw new Error("cannot merge a dish into itself");
  await db.transaction(async (tx) => {
    const [from] = await tx.select().from(schema.dishes).where(eq(schema.dishes.id, fromId));
    const [into] = await tx.select().from(schema.dishes).where(eq(schema.dishes.id, intoId));
    if (!from || !into) throw new Error("dish not found");

    // Same video, place and timestamp already on the kept dish: moving it would break recs_dedupe_uk.
    await tx.execute(sql`
      delete from recommendations f using recommendations i
      where f.dish_id = ${fromId} and i.dish_id = ${intoId}
        and f.source_id = i.source_id and f.place_id = i.place_id
        and coalesce(f.ts_seconds, -1) = coalesce(i.ts_seconds, -1)
    `);
    await tx
      .update(schema.recommendations)
      .set({ dishId: intoId })
      .where(eq(schema.recommendations.dishId, fromId));

    const aliases = await tx
      .select()
      .from(schema.dishAliases)
      .where(eq(schema.dishAliases.dishId, fromId));
    for (const alias of [...aliases.map((a) => a.alias), from.name]) {
      await tx.insert(schema.dishAliases).values({ dishId: intoId, alias }).onConflictDoNothing();
    }
    await tx.delete(schema.dishes).where(eq(schema.dishes.id, fromId));
  });
}

export type GeocodeDeps = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  ua?: string;
};

let lastCall = 0;
type GeoHit = { lat: number; lng: number; osmId: string; displayName: string };
// Per-process cache: one ingest run often looks up the same place twice.
const geoCache = new Map<string, GeoHit | null>();

export async function suggestLocation(
  query: string,
  deps: GeocodeDeps = {},
): Promise<GeoHit | null> {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (geoCache.has(key)) return geoCache.get(key)!;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const wait = Math.max(0, 1000 - (Date.now() - lastCall));
  if (lastCall !== 0) await sleep(wait);
  lastCall = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "in");

  const res = await (deps.fetchImpl ?? fetch)(url, {
    headers: { "user-agent": deps.ua ?? process.env.NOMINATIM_USER_AGENT ?? "ifr/0.1" },
  });
  if (!res.ok) throw new Error(`Nominatim failed with status ${res.status}`);
  const rows = (await res.json()) as {
    lat: string;
    lon: string;
    osm_id: string | number;
    display_name: string;
  }[];
  const first = rows[0];
  const hit: GeoHit | null = first
    ? {
        lat: Number(first.lat),
        lng: Number(first.lon),
        osmId: String(first.osm_id),
        displayName: first.display_name,
      }
    : null;
  geoCache.set(key, hit);
  return hit;
}
