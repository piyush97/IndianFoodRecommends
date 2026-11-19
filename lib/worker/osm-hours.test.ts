import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../../db";
import { importOsmHours } from "./osm-hours";

const dialect = new PgDialect();
const noopWait = async () => {};

const row = (over: Record<string, unknown>) => ({
  id: 1,
  name: "Chache Di Hatti",
  lat: 28.68,
  lng: 77.2,
  osmId: "10",
  openingHours: null,
  openingWeek: null,
  ...over,
});

/** A Db whose select returns `places` and whose transaction records every statement it runs. */
function fakeDb(places: ReturnType<typeof row>[]) {
  const writes: { sql: string; params: unknown[] }[] = [];
  const reads: { sql: string; params: unknown[] }[] = [];
  const tx = {
    execute: async (query: SQL) => {
      writes.push(dialect.sqlToQuery(query));
      return [];
    },
  };
  const db = {
    execute: async (query: SQL) => {
      reads.push(dialect.sqlToQuery(query));
      return places;
    },
    transaction: async (run: (t: typeof tx) => Promise<void>) => run(tx),
  };
  return { db: db as unknown as Db, writes, reads };
}

const overpass = (elements: unknown[]) =>
  vi.fn(async () => new Response(JSON.stringify({ elements }), { status: 200 }));

const cafe = {
  type: "node",
  id: 10,
  lat: 28.68,
  lon: 77.2,
  tags: { name: "Chache Di Hatti", opening_hours: "Mo-Su 08:00-23:00" },
};

const hoursWrites = (writes: { sql: string; params: unknown[] }[]) =>
  writes.filter((w) => w.sql.includes("opening_week"));

describe("importOsmHours", () => {
  beforeEach(() => vi.stubEnv("NOMINATIM_USER_AGENT", "test (test@example.com)"));
  afterEach(() => vi.unstubAllEnvs());

  it("stores hours for an exact pin that matches an OSM place", async () => {
    const { db, writes } = fakeDb([row({})]);
    const result = await importOsmHours(db, "delhi", overpass([cafe]), noopWait);

    expect(result).toEqual([{ city: "delhi", places: 1, matched: 1, changed: 1 }]);
    const [write] = hoursWrites(writes);
    expect(write.params[0]).toBe("Mo-Su 08:00-23:00");
    expect(JSON.parse(write.params[1] as string)).toEqual(
      Array.from({ length: 7 }, () => [[480, 1380]]),
    );
    expect(write.params[2]).toBe(1);
    // the checked date is bumped for every exact pin in the city
    expect(writes.some((w) => w.sql.includes("opening_hours_checked"))).toBe(true);
  });

  it("leaves an approx pin alone even when an OSM place sits on it", async () => {
    const { db, writes } = fakeDb([row({ osmId: "approx:10" })]);
    const result = await importOsmHours(db, "delhi", overpass([cafe]), noopWait);

    expect(result).toEqual([{ city: "delhi", places: 0, matched: 0, changed: 0 }]);
    expect(hoursWrites(writes)).toHaveLength(0);
  });

  it("reads only exact pins when loading a city's places", async () => {
    const { db, reads } = fakeDb([row({})]);
    await importOsmHours(db, "delhi", overpass([cafe]), noopWait);

    const [placesQuery] = reads;
    expect(placesQuery.sql).toContain("approx:");
    expect(placesQuery.sql).toContain("osm_id is not null");
  });

  it("clears hours when an exact pin no longer matches anything", async () => {
    const stored = JSON.stringify([[[480, 1380]]]);
    const { db, writes } = fakeDb([
      row({ openingHours: "Mo-Su 08:00-23:00", openingWeek: stored }),
    ]);
    await importOsmHours(db, "delhi", overpass([]), noopWait);

    const [write] = hoursWrites(writes);
    expect(write.params.slice(0, 2)).toEqual([null, null]);
  });

  it("does not rewrite a place whose hours are unchanged", async () => {
    const week = JSON.stringify(Array.from({ length: 7 }, () => [[480, 1380]]));
    const { db, writes } = fakeDb([row({ openingHours: "Mo-Su 08:00-23:00", openingWeek: week })]);
    const result = await importOsmHours(db, "delhi", overpass([cafe]), noopWait);

    expect(result[0]).toMatchObject({ matched: 1, changed: 0 });
    expect(hoursWrites(writes)).toHaveLength(0);
  });

  it("keeps stored hours when Overpass fails", async () => {
    const stored = row({ openingHours: "Mo-Su 08:00-23:00", openingWeek: "[]" });
    for (const fetchImpl of [
      vi.fn(async () => new Response("busy", { status: 504 })),
      vi.fn(async () => new Response("not json", { status: 200 })),
      vi.fn(async () => Promise.reject(new Error("network down"))),
    ]) {
      const { db, writes } = fakeDb([stored]);
      const [result] = await importOsmHours(db, "delhi", fetchImpl, noopWait);
      expect(result.error).toBeTruthy();
      expect(writes).toHaveLength(0);
    }
  });

  it("retries a 502 and stores hours when the next attempt succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ elements: [cafe] }), { status: 200 }));
    const wait = vi.fn(async (_ms: number) => {});
    const { db, writes } = fakeDb([row({})]);

    const result = await importOsmHours(db, "delhi", fetchImpl, wait);

    expect(result).toEqual([{ city: "delhi", places: 1, matched: 1, changed: 1 }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(30_000);
    expect(hoursWrites(writes)).toHaveLength(1);
  });

  it("gives up after three 502 responses and leaves rows untouched", async () => {
    const fetchImpl = vi.fn(async () => new Response("busy", { status: 502 }));
    const wait = vi.fn(async (_ms: number) => {});
    const { db, writes } = fakeDb([row({})]);

    const [result] = await importOsmHours(db, "delhi", fetchImpl, wait);

    expect(result.error).toBe("Overpass HTTP 502");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([30_000, 60_000]);
    expect(writes).toHaveLength(0);
  });

  it("does not retry a 400 response", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 400 }));
    const wait = vi.fn(async (_ms: number) => {});
    const { db } = fakeDb([row({})]);

    const [result] = await importOsmHours(db, "delhi", fetchImpl, wait);

    expect(result.error).toBe("Overpass HTTP 400");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("rejects an unknown city and a missing user agent", async () => {
    const { db } = fakeDb([]);
    await expect(importOsmHours(db, "atlantis", overpass([]), noopWait)).rejects.toThrow(
      "Unknown city",
    );
    vi.stubEnv("NOMINATIM_USER_AGENT", "");
    await expect(importOsmHours(db, "delhi", overpass([]), noopWait)).rejects.toThrow(
      "NOMINATIM_USER_AGENT",
    );
  });
});
