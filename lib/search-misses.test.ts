import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { logMiss, topMisses } from "./search-misses";

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
});
