import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { syncAreas } from "../lib/areas";
import { CITIES } from "../lib/cities";
import { findArea } from "../lib/geocode-area";
import { judge, loadLocalities, loadQueries, summarise } from "./area-eval";

/** Share of resolvable queries that must land on the expected area. Raise it, never lower it. */
const MIN_RATE = 0.95;

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("area search eval", () => {
  const db = handle?.db as Db;
  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values(CITIES.map((c) => ({ slug: c.slug, name: c.name })));
    const result = await syncAreas(db, loadLocalities());
    // A curated alias that points at no area means the alias file drifted from the data.
    expect(result.unmatchedAliases).toEqual([]);
  });
  afterAll(() => handle?.close());

  it("resolves typos, nicknames and extra words, and refuses what it does not know", async () => {
    // Upstream search is off: this measures our own area list, with no network and no flakiness.
    const offline = async () => null;
    const outcomes = [];
    for (const query of loadQueries()) {
      outcomes.push(judge(query, await findArea(db, query.city, query.q, offline)));
    }
    const s = summarise(outcomes);
    const table = Object.entries(s.byKind)
      .map(([kind, k]) => `${kind.padEnd(9)} ${k.passed}/${k.total}`)
      .join("\n");
    const misses = s.failures.map(
      (f) => `${f.query.city}: "${f.query.q}" -> ${f.got} (want ${f.query.expect})`,
    );
    console.log(
      `area eval ${(s.resolvable.rate * 100).toFixed(1)}%\n${table}\n${misses.join("\n")}`,
    );

    expect(s.rejected.passed, "queries that must not resolve but did").toBe(s.rejected.total);
    expect(s.resolvable.rate).toBeGreaterThanOrEqual(MIN_RATE);
  });
});
