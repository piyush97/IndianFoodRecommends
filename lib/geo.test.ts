import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { nearbyPlaces } from "./geo";
import { getPlace } from "./public/queries";
import { eq } from "drizzle-orm";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

// Origin 28.6, 77.2. One degree of latitude is 111 km, so 0.005 is about 556 m.
const ORIGIN = { lat: 28.6, lng: 77.2 };

describeDb("nearbyPlaces", () => {
  const db = handle?.db as Db;

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values({ slug: "one", name: "One" });
    await db.insert(schema.dishes).values({ slug: "chole", name: "Chole" });
    await db.insert(schema.sources).values({
      platform: "youtube",
      externalId: "v1",
      creatorId: 1,
      publishedOn: "2026-11-01",
    });
    await db.insert(schema.places).values([
      { slug: "self", name: "Self", cityId: 1, lat: 28.6, lng: 77.2 },
      { slug: "near", name: "Near", cityId: 1, lat: 28.605, lng: 77.2 },
      { slug: "mid", name: "Mid", cityId: 1, lat: 28.61, lng: 77.2 },
      // Inside the 1.2 km bounding box but 1.48 km away: only the circle check removes it.
      { slug: "corner", name: "Corner", cityId: 1, lat: 28.61, lng: 77.21 },
      { slug: "far", name: "Far", cityId: 1, lat: 28.7, lng: 77.2 },
      { slug: "nopin", name: "No pin", cityId: 1 },
      { slug: "pending", name: "Pending", cityId: 1, lat: 28.601, lng: 77.2 },
    ]);
    const ok = { sourceId: 1, dishId: 1, status: "approved" as const };
    await db.insert(schema.recommendations).values([
      { ...ok, placeId: 1 },
      { ...ok, placeId: 2 },
      { ...ok, placeId: 3 },
      { ...ok, placeId: 4 },
      { ...ok, placeId: 5 },
      { ...ok, placeId: 6 },
      { ...ok, placeId: 7, status: "pending" },
    ]);
  });
  afterAll(() => handle?.close());

  it("lists places inside the circle, nearest first, with metres", async () => {
    const found = await nearbyPlaces(db, {
      ...ORIGIN,
      radiusKm: 1.2,
      limit: 10,
      exceptSlug: "self",
    });
    expect(found.map((f) => f.slug)).toEqual(["near", "mid"]);
    expect(found[0].meters).toBeGreaterThan(540);
    expect(found[0].meters).toBeLessThan(570);
  });

  it("widens with the radius and honours the limit", async () => {
    const wide = await nearbyPlaces(db, { ...ORIGIN, radiusKm: 2, limit: 10, exceptSlug: "self" });
    expect(wide.map((f) => f.slug)).toEqual(["near", "mid", "corner"]);
    const one = await nearbyPlaces(db, { ...ORIGIN, radiusKm: 2, limit: 1, exceptSlug: "self" });
    expect(one.map((f) => f.slug)).toEqual(["near"]);
  });

  it("skips places without an approved pick and places without a pin", async () => {
    const found = await nearbyPlaces(db, { ...ORIGIN, radiusKm: 50, limit: 10 });
    expect(found.map((f) => f.slug)).toEqual(["self", "near", "mid", "corner", "far"]);
  });

  it("is answered through places_geom_idx", async () => {
    // Seven rows would be scanned in order; forbidding that shows the index can serve the query.
    const plan = await db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      return tx.execute(sql`
        explain select slug from places
        where ST_DWithin(geom, ST_SetSRID(ST_MakePoint(77.2, 28.6), 4326)::geography, 1200)
        order by geom <-> ST_SetSRID(ST_MakePoint(77.2, 28.6), 4326)::geography`);
    });
    expect(plan.map((r) => String(r["QUERY PLAN"])).join("\n")).toContain("places_geom_idx");
  });

  it("puts nearby picks on the place page data, without distances for approximate pins", async () => {
    const exact = await getPlace(db, "delhi", "self");
    expect(exact?.nearby.map((n) => [n.placeSlug, n.meters === null])).toEqual([
      ["near", false],
      ["mid", false],
      ["corner", false],
    ]);
    expect(exact?.nearby[0].meters).toBeGreaterThan(540);

    await db.update(schema.places).set({ osmId: "approx:1" }).where(eq(schema.places.slug, "self"));
    const approx = await getPlace(db, "delhi", "self");
    expect(approx?.nearby.every((n) => n.meters === null)).toBe(true);
    expect((await getPlace(db, "delhi", "nopin"))?.nearby).toEqual([]);
  });
});
