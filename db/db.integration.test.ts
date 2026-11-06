import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import { schema, type Db } from "./index";
import { seed } from "./seed";
import { dishes as seedDishes } from "./seed-data";
import { testDb, truncateAll } from "./test-db";

// Runs against DATABASE_URL_TEST only; never touches the dev database.
const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("seed + schema", () => {
  const db = handle?.db as Db;

  beforeAll(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await handle!.close();
  });

  it("is idempotent", async () => {
    await seed(db);
    await seed(db);
    const [row] = await db.select({ n: count() }).from(schema.dishes);
    expect(row.n).toBe(seedDishes.length);
  });

  it("dedupes a recommendation with null place/dish/timestamp", async () => {
    const [creator] = await db
      .insert(schema.creators)
      .values({ slug: "test-creator", name: "Test Creator" })
      .returning();
    const [source] = await db
      .insert(schema.sources)
      .values({ platform: "youtube", externalId: "test-video", creatorId: creator.id })
      .returning();

    const values = { sourceId: source.id, confidence: 0.9 };
    await db.insert(schema.recommendations).values(values);
    const second = await db
      .insert(schema.recommendations)
      .values(values)
      .onConflictDoNothing()
      .returning();

    expect(second).toHaveLength(0);
  });
});
