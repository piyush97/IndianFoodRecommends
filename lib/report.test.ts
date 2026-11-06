import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { createReport, hashIp } from "./report";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describe("hashIp", () => {
  it("is a salted hex SHA-256 that never contains the IP", () => {
    const h = hashIp("203.0.113.9", "salt");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("203.0.113.9");
    expect(hashIp("203.0.113.9", "other")).not.toBe(h);
  });
});

describeDb("createReport", () => {
  const db = handle?.db as Db;
  const now = new Date("2026-11-06T12:00:00Z");

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.places).values({ slug: "a", name: "A", cityId: 1 });
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("stores a valid report with the hash, not the IP", async () => {
    const res = await createReport(db, { placeId: 1, kind: "closed" }, hashIp("1.2.3.4", "s"), now);
    expect(res).toEqual({ ok: true });
    const [row] = await db.select().from(schema.reports);
    expect(row).toMatchObject({ placeId: 1, kind: "closed" });
    expect(row.ipHash).not.toBe("1.2.3.4");
  });

  it("returns 404 for an unknown place and writes nothing", async () => {
    expect(await createReport(db, { placeId: 999, kind: "closed" }, "h", now)).toEqual({
      ok: false,
      status: 404,
    });
    expect(await db.select().from(schema.reports)).toHaveLength(0);
  });

  it("returns 400 for an unknown kind or an over-long message", async () => {
    expect(await createReport(db, { placeId: 1, kind: "spam" }, "h", now)).toEqual({
      ok: false,
      status: 400,
    });
    expect(
      await createReport(db, { placeId: 1, kind: "other", message: "x".repeat(501) }, "h", now),
    ).toEqual({ ok: false, status: 400 });
  });

  it("holds the limit under parallel requests from one IP", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        createReport(db, { placeId: 1, kind: "other" }, "burst", now),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(await db.select().from(schema.reports)).toHaveLength(5);
  });

  it("returns 400 for a placeId outside the integer column range", async () => {
    expect(await createReport(db, { placeId: 3_000_000_000, kind: "closed" }, "h", now)).toEqual({
      ok: false,
      status: 400,
    });
  });

  it("rate limits the sixth report per IP hash per minute", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await createReport(db, { placeId: 1, kind: "other" }, "same", now)).toEqual({
        ok: true,
      });
    }
    expect(await createReport(db, { placeId: 1, kind: "other" }, "same", now)).toEqual({
      ok: false,
      status: 429,
    });
    expect(await db.select().from(schema.reports)).toHaveLength(5);
    expect(await createReport(db, { placeId: 1, kind: "other" }, "different", now)).toEqual({
      ok: true,
    });
  });
});
