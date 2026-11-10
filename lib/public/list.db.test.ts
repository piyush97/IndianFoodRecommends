import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import { getListCards } from "./queries";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
const now = new Date("2026-11-06T00:00:00Z");

describeDb("getListCards", () => {
  const db = handle?.db as Db;

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values([
      { slug: "one", name: "One" },
      { slug: "gone", name: "Gone", optedOut: true },
    ]);
    await db.insert(schema.dishes).values({ slug: "chole-bhature", name: "Chole Bhature" });
    await db
      .insert(schema.places)
      .values(
        ["a", "b", "c", "p", "o"].map((slug) => ({ slug, name: slug.toUpperCase(), cityId: 1 })),
      );
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "v1", creatorId: 1, publishedOn: "2026-11-01" },
      { platform: "youtube", externalId: "v2", creatorId: 2, publishedOn: "2026-11-01" },
    ]);
    const ok = { status: "approved" as const, dishId: 1 };
    await db.insert(schema.recommendations).values([
      { ...ok, sourceId: 1, placeId: 1 }, // a
      { ...ok, sourceId: 1, placeId: 2 }, // b
      { ...ok, sourceId: 1, placeId: 3 }, // c
      { status: "pending", sourceId: 1, placeId: 4, dishId: 1 }, // p: pending only
      { ...ok, sourceId: 2, placeId: 5 }, // o: opted-out creator only
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("keeps URL order and drops unknown, pending and opted-out places", async () => {
    const cards = await getListCards(db, ["c", "p", "a", "o", "zz", "b"], now);
    expect(cards.map((c) => c.placeSlug)).toEqual(["c", "a", "b"]);
  });

  it("returns nothing for hostile or empty input without throwing", async () => {
    expect(await getListCards(db, [], now)).toEqual([]);
    expect(await getListCards(db, ["../x", "'; drop table places;--"], now)).toEqual([]);
  });
});
