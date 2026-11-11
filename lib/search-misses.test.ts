import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { searchAll } from "./public/search";
import { addMissAsAlias, logMiss, topMisses } from "./search-misses";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("search misses", () => {
  const db = handle?.db as Db;
  beforeEach(() => truncateAll(db));
  afterAll(() => handle?.close());

  it("counts repeats case-insensitively and ranks by hits", async () => {
    await logMiss(db, "Pizza");
    await logMiss(db, "  pizza ");
    await logMiss(db, "ramen");
    const rows = await topMisses(db);
    expect(rows.map((r) => [r.query, r.hits])).toEqual([
      ["pizza", 2],
      ["ramen", 1],
    ]);
  });

  it("ignores empty and oversized queries", async () => {
    await logMiss(db, "a");
    await logMiss(db, "x".repeat(80));
    expect(await topMisses(db)).toEqual([]);
  });

  it("drops one-hit queries older than 30 days on the next log, keeps repeated ones", async () => {
    await db.insert(schema.searchMisses).values([
      { query: "old once", hits: 1, lastAt: new Date("2020-01-01") },
      { query: "old twice", hits: 2, lastAt: new Date("2020-01-01") },
    ]);
    await logMiss(db, "fresh");
    const all = await db.select().from(schema.searchMisses);
    expect(all.map((r) => r.query).sort()).toEqual(["fresh", "old twice"]);
    expect((await topMisses(db)).map((r) => r.query)).toEqual(["fresh"]);
  });

  describe("addMissAsAlias", () => {
    beforeEach(async () => {
      await db.insert(schema.dishes).values({ slug: "chole-bhature", name: "Chole Bhature" });
    });

    const aliases = async () => (await db.select().from(schema.dishAliases)).map((a) => a.alias);
    const misses = async () => (await db.select().from(schema.searchMisses)).map((m) => m.query);

    it("adds alias and removes miss", async () => {
      await logMiss(db, "Chhole Bature");
      expect(await addMissAsAlias(db, "chhole bature", "chole-bhature")).toBe("added");
      expect(await aliases()).toEqual(["chhole bature"]);
      expect(await misses()).toEqual([]);
    });

    it("stores the normalized query", async () => {
      await db.insert(schema.searchMisses).values({ query: "chhole bature" });
      expect(await addMissAsAlias(db, "  Chhole   BATURE ", "chole-bhature")).toBe("added");
      expect(await aliases()).toEqual(["chhole bature"]);
      expect(await misses()).toEqual([]);
    });

    it("unknown dish -> no-dish, miss kept", async () => {
      await logMiss(db, "chhole bature");
      expect(await addMissAsAlias(db, "chhole bature", "nope")).toBe("no-dish");
      expect(await aliases()).toEqual([]);
      expect(await misses()).toEqual(["chhole bature"]);
    });

    it("duplicate alias -> exists, miss removed", async () => {
      await db.insert(schema.dishAliases).values({ dishId: 1, alias: "chhole bature" });
      await logMiss(db, "chhole bature");
      expect(await addMissAsAlias(db, "chhole bature", "chole-bhature")).toBe("exists");
      expect(await aliases()).toEqual(["chhole bature"]);
      expect(await misses()).toEqual([]);
    });

    it("rejects a blank query and keeps every miss", async () => {
      await logMiss(db, "ramen");
      await expect(addMissAsAlias(db, " !! ", "chole-bhature")).rejects.toThrow(/blank/);
      expect(await aliases()).toEqual([]);
      expect(await misses()).toEqual(["ramen"]);
    });

    it("alias is matched by searchAll afterwards", async () => {
      await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
      await db.insert(schema.creators).values({ slug: "ayush", name: "Aayush Sapra" });
      await db.insert(schema.places).values({ slug: "a", name: "A", cityId: 1 });
      await db
        .insert(schema.sources)
        .values({ platform: "youtube", externalId: "v", creatorId: 1 });
      await db
        .insert(schema.recommendations)
        .values({ sourceId: 1, placeId: 1, dishId: 1, status: "approved" });
      await logMiss(db, "kulche choley");
      expect((await searchAll(db, "kulche choley")).dishes).toEqual([]);
      await addMissAsAlias(db, "kulche choley", "chole-bhature");
      expect((await searchAll(db, "Kulche Choley")).dishes.map((d) => d.slug)).toEqual([
        "chole-bhature",
      ]);
    });
  });
});
