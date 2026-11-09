import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createRequire } from "node:module";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import {
  getArea,
  getSpatialPicks,
  listAreas,
  nearAreaSearch,
  parseBounds,
  pickTile,
  parseTileCoordinates,
} from "./spatial";

describe("viewport validation", () => {
  it("rejects missing, reversed, non-finite and out-of-range coordinates", () => {
    for (const raw of [
      "",
      "1,2,3",
      "1,,3,4",
      "NaN,2,3,4",
      "78,28,77,29",
      "77,29,78,28",
      "-181,0,1,2",
    ])
      expect(parseBounds(raw)).toBeNull();
    expect(parseBounds("77.1,28.5,77.3,28.7")).toEqual([77.1, 28.5, 77.3, 28.7]);
  });
});

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
describeDb("spatial food discovery", () => {
  const db = handle?.db as Db;
  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values([
      { slug: "delhi", name: "Delhi" },
      { slug: "mumbai", name: "Mumbai" },
    ]);
    await db.insert(schema.creators).values([
      { slug: "one", name: "One" },
      { slug: "hidden", name: "Hidden", optedOut: true },
    ]);
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "s1", creatorId: 1 },
      { platform: "youtube", externalId: "s2", creatorId: 2 },
    ]);
    await db.insert(schema.dishes).values([
      { slug: "chole-bhature", name: "Chole Bhature", diet: "veg" },
      { slug: "momos", name: "Momos", diet: "non-veg" },
    ]);
    await db.insert(schema.dishAliases).values({ dishId: 1, alias: "chole bature" });
    await db.insert(schema.places).values([
      { slug: "close", name: "Close", cityId: 1, lat: 28.65, lng: 77.23, osmId: "node/1" },
      { slug: "second", name: "Second", cityId: 1, lat: 28.66, lng: 77.23, osmId: "approx:2" },
      { slug: "far", name: "Far", cityId: 1, lat: 28.69, lng: 77.23 },
      { slug: "hidden", name: "Hidden", cityId: 1, lat: 28.65, lng: 77.23 },
      { slug: "pending", name: "Pending", cityId: 1, lat: 28.65, lng: 77.23 },
      { slug: "other-dish", name: "Other dish", cityId: 1, lat: 28.65, lng: 77.23 },
      { slug: "other-city", name: "Other city", cityId: 2, lat: 28.65, lng: 77.23 },
    ]);
    await db
      .insert(schema.recommendations)
      .values([
        ...[1, 2, 3, 7].map((placeId) => ({
          placeId,
          sourceId: 1,
          dishId: 1,
          status: "approved" as const,
        })),
        { placeId: 4, sourceId: 2, dishId: 1, status: "approved" },
        { placeId: 5, sourceId: 1, dishId: 1, status: "pending" },
        { placeId: 6, sourceId: 1, dishId: 2, status: "approved" },
      ]);
    await db.insert(schema.areas).values([
      {
        cityId: 1,
        name: "Chandni Chowk",
        key: "chandni chowk",
        slug: "chandni-chowk",
        lat: 28.65,
        lng: 77.23,
      },
      { cityId: 1, name: "Empty", key: "empty", slug: "empty", lat: 28.1, lng: 77.1 },
    ]);
    await db.insert(schema.areaAliases).values({ areaId: 1, alias: "CC", key: "cc" });
  });
  afterAll(() => handle?.close());

  it("finds only the requested dish within 2 km, nearest first, including aliases and typos", async () => {
    for (const q of [
      "chole bhature near chandni chowk",
      "chole bature in chandini chowk",
      "chole bhature cc",
      "chole bhature near chandni chowk in delhi",
    ]) {
      const res = await nearAreaSearch(db, q, "delhi");
      expect(
        res?.cards.map((p) => p.placeSlug),
        q,
      ).toEqual(["close", "second"]);
      expect(res?.cards[0].distanceM).toBeLessThan(1);
      expect(res?.cards[1].distanceM).toBeGreaterThan(1000);
    }
    expect(await nearAreaSearch(db, "chole bhature", "delhi")).toBeNull();
    expect((await nearAreaSearch(db, "momos near nowhere", "delhi"))?.cards).toEqual([]);
  });

  it("keeps viewport results inside the box and hides pending, opted-out and other-city picks", async () => {
    const cards = await getSpatialPicks(db, "delhi", { bbox: [77.22, 28.649, 77.24, 28.655] });
    expect(cards.map((p) => p.placeSlug).sort()).toEqual(["close", "other-dish"]);
    expect(await getSpatialPicks(db, "unknown", { bbox: [77.22, 28.649, 77.24, 28.655] })).toEqual(
      [],
    );
  });

  it("uses the centroid's 1 km radius when there is no OSM boundary", async () => {
    expect(
      (await getSpatialPicks(db, "delhi", { area: "chandni-chowk" }))
        .map((p) => p.placeSlug)
        .sort(),
    ).toEqual(["close", "other-dish"]);
    expect((await listAreas(db, "delhi")).map((a) => a.slug)).toEqual(["chandni-chowk"]);
    expect(await getArea(db, "delhi", "unknown")).toBeNull();
  });

  it("uses polygon coverage, including its edge, instead of the centroid radius", async () => {
    // lat/lng are float4: use the stored point as the exact polygon corner.
    await db.execute(sql`update areas set boundary=ST_MakeEnvelope(
      (select ST_X(geom::geometry) from places where slug='close'),
      (select ST_Y(geom::geometry) from places where slug='close'),77.24,28.665,4326) where id=1`);
    expect(
      (await getSpatialPicks(db, "delhi", { area: "chandni-chowk", dishes: ["chole-bhature"] }))
        .map((p) => p.placeSlug)
        .sort(),
    ).toEqual(["close", "second"]);
    expect(
      (await getSpatialPicks(db, "delhi", { area: "chandni-chowk", diet: "non-veg" })).map(
        (p) => p.placeSlug,
      ),
    ).toEqual(["other-dish"]);
  });

  it("encodes valid vector tiles with visible city/dish picks, not pending or opted-out sources", async () => {
    const require = createRequire(import.meta.url);
    const fromMap = createRequire(require.resolve("maplibre-gl/package.json"));
    const { VectorTile } = fromMap("@mapbox/vector-tile");
    const { PbfReader } = fromMap("pbf");
    const bytes = await pickTile(db, "delhi", [0, 0, 0], { dish: "chole-bhature" });
    const tile = new VectorTile(new PbfReader(bytes));
    const features = tile.layers.picks;
    const slugs = Array.from(
      { length: features.length },
      (_, i) => features.feature(i).properties.slug,
    );
    expect(slugs.sort()).toEqual(["close", "far", "second"]);
    expect((await pickTile(db, "delhi", [1, 1, 0], {})).length).toBeGreaterThan(0);
    expect((await pickTile(db, "delhi", [18, 0, 0], {})).length).toBe(0);
    expect(parseTileCoordinates("1", "2", "0")).toBeNull();
    expect(parseTileCoordinates("19", "0", "0")).toBeNull();
    expect(parseTileCoordinates("1e1", "0", "0")).toBeNull();
    expect(parseTileCoordinates("0", "0", "0")).toEqual([0, 0, 0]);
  });
});
