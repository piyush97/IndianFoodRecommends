import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import { sitemapPaths } from "./sitemap";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("sitemapPaths", () => {
  const db = handle?.db as Db;

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values([
      { slug: "one", name: "One" },
      { slug: "gone", name: "Gone", optedOut: true },
    ]);
    await db.insert(schema.dishes).values([
      { slug: "chole-bhature", name: "Chole Bhature" },
      { slug: "momos", name: "Momos" },
    ]);
    await db.insert(schema.places).values([
      { slug: "a", name: "A", cityId: 1, lat: 28.65, lng: 77.23 },
      { slug: "pending-only", name: "P", cityId: 1 },
      { slug: "gone-only", name: "G", cityId: 1 },
      { slug: "closed-one", name: "Closed", cityId: 1, lat: 28.65, lng: 77.23, status: "closed" },
    ]);
    await db.insert(schema.dishes).values({ slug: "closed-dish", name: "Closed Dish" });
    await db.insert(schema.creators).values({ slug: "closed-vlogger", name: "Closed Vlogger" });
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "v1", creatorId: 1 },
      { platform: "youtube", externalId: "v2", creatorId: 1 },
      { platform: "youtube", externalId: "v3", creatorId: 2 },
      { platform: "youtube", externalId: "v4", creatorId: 3 },
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
    await db.insert(schema.recommendations).values([
      { sourceId: 1, placeId: 1, dishId: 1, status: "approved" },
      { sourceId: 2, placeId: 1, dishId: 1, status: "approved", tsSeconds: 5 },
      { sourceId: 1, placeId: 2, dishId: 2, status: "pending" },
      { sourceId: 3, placeId: 3, dishId: 2, status: "approved" },
      { sourceId: 4, placeId: 4, dishId: 3, status: "approved" },
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("lists only pages with visible approved picks, once each", async () => {
    const paths = (await sitemapPaths(db)).map((p) => p.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/delhi",
        "/delhi/chole-bhature",
        "/delhi/place/a",
        "/creator/one",
        "/delhi/area/chandni-chowk",
      ]),
    );
    expect(paths).not.toContain("/delhi/place/pending-only");
    expect(paths).not.toContain("/delhi/place/gone-only");
    expect(paths).not.toContain("/delhi/momos");
    expect(paths).not.toContain("/creator/gone");
    expect(paths).not.toContain("/delhi/place/closed-one");
    expect(paths).not.toContain("/delhi/closed-dish");
    expect(paths).not.toContain("/creator/closed-vlogger");
    expect(paths).not.toContain("/delhi/area/empty");
    // Place a has two videos from one creator: not enough for the agree page.
    expect(paths).not.toContain("/delhi/agree");
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("dates every entry", async () => {
    for (const entry of await sitemapPaths(db)) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});
