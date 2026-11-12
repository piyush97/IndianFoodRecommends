import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import { refreshHeatmap, refreshWalks } from "./geo";
import { getHeatmap, getWalks } from "../public/spatial";
import { walkDirections } from "../public/links";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
describeDb("precomputed food geography", () => {
  const db = handle?.db as Db;
  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values([
      { slug: "one", name: "One" },
      { slug: "hidden", name: "Hidden", optedOut: true },
    ]);
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "s1", creatorId: 1 },
      { platform: "youtube", externalId: "s2", creatorId: 2 },
    ]);
    await db.insert(schema.dishes).values({ slug: "chole-bhature", name: "Chole Bhature" });
    await db.insert(schema.places).values([
      ...[0, 1, 2, 3].map((i) => ({
        slug: `exact-${i}`,
        name: `Exact ${i}`,
        cityId: 1,
        lat: 28.65,
        lng: 77.23 + i * 0.001,
        osmId: `node/${i + 1}`,
      })),
      {
        slug: "approx",
        name: "Approximate",
        cityId: 1,
        lat: 28.65,
        lng: 77.23,
        osmId: "approx:5",
      },
      { slug: "hidden", name: "Hidden", cityId: 1, lat: 28.65, lng: 77.23, osmId: "node/6" },
      { slug: "isolated", name: "Isolated", cityId: 1, lat: 28.8, lng: 77.4, osmId: "node/7" },
      { slug: "unverified", name: "Unverified", cityId: 1, lat: 28.65, lng: 77.23 },
      { slug: "pending", name: "Pending", cityId: 1, lat: 28.65, lng: 77.23, osmId: "node/9" },
      {
        slug: "closed",
        name: "Closed",
        cityId: 1,
        lat: 28.65,
        lng: 77.23,
        osmId: "node/10",
        status: "closed",
      },
    ]);
    await db.insert(schema.recommendations).values(
      Array.from({ length: 10 }, (_, i) => ({
        placeId: i + 1,
        sourceId: i === 5 ? 2 : 1,
        dishId: 1,
        status: i === 8 ? ("pending" as const) : ("approved" as const),
      })),
    );
  });
  afterAll(() => handle?.close());

  it("builds deterministic walks with four exact, open, visible stops and no duplicates on rerun", async () => {
    expect(await refreshWalks(db, "delhi")).toBe(1);
    expect(await refreshWalks(db, "delhi")).toBe(1);
    const walks = await getWalks(db, "delhi");
    expect(walks).toHaveLength(1);
    expect(walks[0].stops.map((p) => p.placeSlug)).toEqual([
      "exact-0",
      "exact-1",
      "exact-2",
      "exact-3",
    ]);
    expect(walks[0].meters).toBeGreaterThan(250);
    expect(walks[0].meters).toBeLessThan(400);
    const directions = new URL(walkDirections(walks[0].stops)!);
    expect(directions.searchParams.get("travelmode")).toBe("walking");
    expect(directions.searchParams.get("waypoints")?.split("|")).toHaveLength(2);
    const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int n from food_walks`);
    expect(n).toBe(1);
  });

  it("returns two walks that share places with each walk's stops in order", async () => {
    await db.delete(schema.foodWalks);
    await db.insert(schema.foodWalks).values([
      { cityId: 1, slug: "a-walk", name: "A walk", stopIds: [1, 2, 3, 4], meters: 300 },
      { cityId: 1, slug: "b-walk", name: "B walk", stopIds: [1, 2, 3, 7], meters: 300 },
    ]);
    const walks = await getWalks(db, "delhi");
    expect(walks.map((w) => w.slug)).toEqual(["a-walk", "b-walk"]);
    expect(walks[0].stops.map((p) => p.placeSlug)).toEqual([
      "exact-0",
      "exact-1",
      "exact-2",
      "exact-3",
    ]);
    expect(walks[1].stops.map((p) => p.placeSlug)).toEqual([
      "exact-0",
      "exact-1",
      "exact-2",
      "isolated",
    ]);
  });

  it("precomputes H3 polygons when available and excludes opted-out creators at read time", async () => {
    const result = await refreshHeatmap(db, "delhi");
    const [{ available }] = await db.execute<{ available: boolean }>(
      sql`select exists(select 1 from pg_available_extensions where name='h3') available`,
    );
    expect(result.available).toBe(available);
    if (!available) return;
    expect(result.cells).toBeGreaterThan(0);
    const data = await getHeatmap(db, "delhi");
    expect(data.type).toBe("FeatureCollection");
    expect(data.features.length).toBeGreaterThan(0);
    expect(data.features[0].geometry.type).toMatch(/Polygon/);
    await db.update(schema.creators).set({ optedOut: true }).where(eq(schema.creators.id, 1));
    expect((await getHeatmap(db, "delhi")).features).toEqual([]);
    await db.update(schema.creators).set({ optedOut: false }).where(eq(schema.creators.id, 1));
  });

  it("hides stale walks immediately when a stop closes, then rebuilds to an honest empty result", async () => {
    await db.update(schema.places).set({ status: "closed" }).where(eq(schema.places.id, 1));
    expect(await getWalks(db, "delhi")).toEqual([]);
    expect(await refreshWalks(db, "delhi")).toBe(0);
    expect(await getWalks(db, "delhi")).toEqual([]);
    expect(walkDirections([])).toBeNull();
  });
});
