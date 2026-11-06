import { afterAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { client, db, schema } from "./index";
import { seed } from "./seed";
import { dishes as seedDishes } from "./seed-data";

// Runs only where a migrated database is reachable (CI db job).
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("seed + schema", () => {
  afterAll(async () => {
    await client.end();
  });

  it("is idempotent", async () => {
    await seed();
    await seed();
    const [row] = await db.select({ n: count() }).from(schema.dishes);
    expect(row.n).toBe(seedDishes.length);
  });

  it("dedupes a recommendation with null place/dish/timestamp", async () => {
    const [city] = await db
      .select()
      .from(schema.cities)
      .where(eq(schema.cities.slug, "delhi"));
    const [creator] = await db
      .insert(schema.creators)
      .values({ slug: "test-creator", name: "Test Creator" })
      .onConflictDoNothing()
      .returning();
    const creatorId =
      creator?.id ??
      (
        await db
          .select()
          .from(schema.creators)
          .where(eq(schema.creators.slug, "test-creator"))
      )[0].id;

    expect(city).toBeDefined();
    const [source] = await db
      .insert(schema.sources)
      .values({
        platform: "youtube",
        externalId: "dQw4w9WgXcQ",
        creatorId,
      })
      .onConflictDoNothing()
      .returning();
    const sourceId =
      source?.id ??
      (
        await db
          .select()
          .from(schema.sources)
          .where(eq(schema.sources.externalId, "dQw4w9WgXcQ"))
      )[0].id;

    const values = { sourceId, confidence: 0.9 };
    await db.insert(schema.recommendations).values(values);
    const second = await db
      .insert(schema.recommendations)
      .values(values)
      .onConflictDoNothing()
      .returning();

    expect(second).toHaveLength(0);
  });
});
