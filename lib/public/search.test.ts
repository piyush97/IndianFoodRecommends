import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import { searchAll } from "./search";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("searchAll", () => {
  const db = handle?.db as Db;

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values([
      { slug: "bhooka-saand", name: "Bhooka Saand" },
      { slug: "gone", name: "Gone Vlogs", optedOut: true },
    ]);
    await db.insert(schema.dishes).values([
      { slug: "chole-bhature", name: "Chole Bhature" },
      { slug: "momos", name: "Momos" },
      { slug: "nihari", name: "Nihari" },
    ]);
    await db.insert(schema.dishAliases).values({ dishId: 1, alias: "chole bature" });
    await db.insert(schema.places).values([
      { slug: "chache-di-hatti", name: "Chache Di Hatti", cityId: 1, locality: "Kamla Nagar" },
      { slug: "hidden", name: "Hidden Momo Hut", cityId: 1 },
    ]);
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "v1", creatorId: 1 },
      { platform: "youtube", externalId: "v2", creatorId: 2 },
    ]);
    await db.insert(schema.recommendations).values([
      { sourceId: 1, placeId: 1, dishId: 1, status: "approved" },
      { sourceId: 1, placeId: 2, dishId: 2, status: "pending" },
      { sourceId: 2, placeId: 1, dishId: 3, status: "approved" },
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("finds a dish through a transliteration alias", async () => {
    const res = await searchAll(db, "chole bature");
    expect(res.dishes[0]?.slug).toBe("chole-bhature");
  });

  it("finds a misspelled place", async () => {
    const res = await searchAll(db, "chachey");
    expect(res.places.map((p) => p.slug)).toContain("chache-di-hatti");
  });

  it("finds a creator by partial name", async () => {
    const res = await searchAll(db, "bhooka");
    expect(res.creators).toEqual([{ slug: "bhooka-saand", name: "Bhooka Saand" }]);
  });

  it("returns nothing for blank input", async () => {
    expect(await searchAll(db, "   ")).toEqual({ dishes: [], places: [], creators: [] });
  });

  it("treats SQL wildcards and quotes as plain text", async () => {
    await expect(searchAll(db, "100%_'; drop table places;--")).resolves.toEqual({
      dishes: [],
      places: [],
      creators: [],
    });
  });

  it("survives very long input", async () => {
    await expect(searchAll(db, "chole ".repeat(100))).resolves.toBeDefined();
  });

  it("hides entities without a visible approved pick", async () => {
    const res = await searchAll(db, "momo");
    expect(res.dishes).toEqual([]);
    expect(res.places).toEqual([]);
    const nihari = await searchAll(db, "nihari");
    expect(nihari.dishes).toEqual([]);
    expect((await searchAll(db, "gone vlogs")).creators).toEqual([]);
  });
});
