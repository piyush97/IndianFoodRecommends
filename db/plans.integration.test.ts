import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Db } from "./index";
import { testDb } from "./test-db";
import { seedPerfPlaces } from "./perf-seed";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

/** 50k rows: the size the PRD expects before real data catches up. */
const ROWS = 50_000;

function planText(rows: unknown): string {
  return JSON.stringify(rows);
}

// Other DB test files truncate shared tables in parallel, so any EXPLAIN here can wait
// on their locks or a re-seed; one suite-wide budget instead of per-test ones.
describeDb("hot query plans at 50k places", { timeout: 240_000 }, () => {
  let db: Db;
  let total: number;

  beforeAll(async () => {
    db = handle!.db;
    total = await seedPerfPlaces(db, ROWS);
  }, 240_000);

  it("seeds the synthetic rows", () => {
    expect(total).toBeGreaterThanOrEqual(ROWS);
  });

  // Other DB test files truncate shared tables, and vitest runs files in
  // parallel, so re-seed before each plan assertion instead of trusting beforeAll.
  async function ensureRows() {
    // Rebuild the synthetic set from scratch: earlier test files truncate shared
    // tables, and leftover rows from a previous run would change the estimates.
    await db.execute(sql`delete from places where slug like 'perf-place-%'`);
    total = await seedPerfPlaces(db, ROWS);
  }

  it("uses the trigram index for a selective name pattern", async () => {
    await ensureRows();
    // Matches about one row in 50k, the shape of a real search term.
    const plan = await db.execute(sql`
      explain (format json) select slug, name
      from places
      where lower(name) ilike '%perf 5f2c%'
      limit 10
    `);
    const text = planText(plan);
    expect(text).toContain("places_name_lower_trgm_idx");
    expect(text.toUpperCase()).not.toContain('"SEQ SCAN"');
  });

  it("uses the GiST index for nearby picks", async () => {
    await ensureRows();
    const plan = await db.execute(sql`
      explain (format json) select slug, name
      from places
      where st_dwithin(geom, st_setsrid(st_makepoint(77.21, 28.63), 4326)::geography, 2000)
      limit 20
    `);
    expect(planText(plan)).toContain("places_geom_idx");
  });

  it("uses the unique index for a slug lookup", async () => {
    await ensureRows();
    const plan = await db.execute(sql`
      explain (format json) select slug, name from places where slug = 'perf-place-7'
    `);
    expect(planText(plan)).toContain("places_slug_unique");
  });
});
