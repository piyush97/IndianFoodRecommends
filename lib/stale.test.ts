import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { stalePlaces } from "./stale";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
const now = new Date("2026-11-07T00:00:00Z");

describeDb("stalePlaces", () => {
  const db = handle?.db as Db;

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values({ slug: "c", name: "C" });
    await db.insert(schema.dishes).values({ slug: "d", name: "D" });
    await db.insert(schema.places).values([
      { slug: "old", name: "Old", cityId: 1, lastVerified: "2025-09-01" },
      { slug: "fresh", name: "Fresh", cityId: 1, lastVerified: "2026-08-01" },
      { slug: "never", name: "Never", cityId: 1, lastVerified: null },
      { slug: "pending-only", name: "Pending", cityId: 1, lastVerified: null },
    ]);
    await db.insert(schema.sources).values({ platform: "youtube", externalId: "v", creatorId: 1 });
    await db.insert(schema.recommendations).values([
      { sourceId: 1, placeId: 1, dishId: 1, status: "approved" },
      { sourceId: 1, placeId: 2, dishId: 1, status: "approved" },
      { sourceId: 1, placeId: 3, dishId: 1, status: "approved" },
      { sourceId: 1, placeId: 4, dishId: 1, status: "pending" },
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("lists public places unverified for a year, never-verified first", async () => {
    const rows = await stalePlaces(db, now);
    expect(rows.map((r) => r.slug)).toEqual(["never", "old"]);
    expect(rows[1]).toMatchObject({ citySlug: "delhi", lastVerified: "2025-09-01", picks: 1 });
  });
});
