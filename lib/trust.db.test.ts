import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { flaggedPlaceIds, flaggedPlaces } from "./trust";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
const now = new Date("2026-11-10T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describeDb("flaggedPlaceIds", () => {
  const db = handle?.db as Db;

  async function reports(
    placeId: number,
    hashes: (string | null)[],
    kind = "closed",
    extra: { createdAt?: Date; resolvedAt?: Date } = {},
  ) {
    await db
      .insert(schema.reports)
      .values(hashes.map((ipHash) => ({ placeId, kind, ipHash, ...extra })));
  }

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.places).values([
      { slug: "a", name: "A", cityId: 1 },
      { slug: "b", name: "B", cityId: 1 },
    ]);
  });

  beforeEach(async () => {
    await db.delete(schema.reports);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("flags at 3 distinct hashes", async () => {
    await reports(1, ["h1", "h2", "h3"]);
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set([1]));
  });

  it("does not flag at 2 distinct hashes", async () => {
    await reports(1, ["h1", "h2"]);
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set());
  });

  it("same hash 3 times does not flag", async () => {
    await reports(1, ["h1", "h1", "h1"]);
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set());
  });

  it("null hashes do not count", async () => {
    await reports(1, ["h1", "h2", null, null]);
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set());
  });

  it("older than 60 days is ignored", async () => {
    await reports(1, ["h1", "h2", "h3"], "closed", { createdAt: daysAgo(61) });
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set());
  });

  it("counts reports inside the 60 day window", async () => {
    await reports(1, ["h1", "h2", "h3"], "closed", { createdAt: daysAgo(59) });
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set([1]));
  });

  it("resolved reports are ignored", async () => {
    await reports(1, ["h1", "h2", "h3"], "closed", { resolvedAt: daysAgo(1) });
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set());
  });

  it("wrong-info and other reports do not count", async () => {
    await reports(1, ["h1", "h2", "h3"], "wrong-info");
    await reports(1, ["h4", "h5", "h6"], "other");
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set());
  });

  it("counts closed and moved reports together", async () => {
    await reports(1, ["h1"], "closed");
    await reports(1, ["h2", "h3"], "moved");
    expect(await flaggedPlaceIds(db, [1], now)).toEqual(new Set([1]));
  });

  it("answers many places in one call and returns only the flagged ones", async () => {
    await reports(1, ["h1", "h2", "h3"]);
    await reports(2, ["h1", "h2"]);
    expect(await flaggedPlaceIds(db, [1, 2], now)).toEqual(new Set([1]));
  });

  it("returns an empty set for no ids without touching the database", async () => {
    expect(await flaggedPlaceIds({} as Db, [], now)).toEqual(new Set());
  });

  it("says moved only when every counted report is a moved report", async () => {
    await reports(1, ["h1", "h2", "h3"], "moved");
    await reports(2, ["h1", "h2"], "closed");
    await reports(2, ["h3"], "moved");
    expect(await flaggedPlaces(db, [1, 2], now)).toEqual(
      new Map([
        [1, "moved"],
        [2, "closed"],
      ]),
    );
  });
});
