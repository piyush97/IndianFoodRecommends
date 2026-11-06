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

  it("dedupes matched picks but allows several unmatched pending picks", async () => {
    const [creator] = await db
      .insert(schema.creators)
      .values({ slug: "test-creator", name: "Test Creator" })
      .returning();
    const [source] = await db
      .insert(schema.sources)
      .values({ platform: "youtube", externalId: "test-video", creatorId: creator.id })
      .returning();
    const [city] = await db.select().from(schema.cities).limit(1);
    const [place] = await db
      .insert(schema.places)
      .values({ slug: "test-place", name: "Test Place", cityId: city.id })
      .returning();
    const [dish] = await db.select().from(schema.dishes).limit(1);

    const unmatched = { sourceId: source.id, confidence: 0.9 };
    await db.insert(schema.recommendations).values(unmatched);
    await db.insert(schema.recommendations).values(unmatched);

    const matched = { sourceId: source.id, placeId: place.id, dishId: dish.id };
    await db.insert(schema.recommendations).values(matched);
    const second = await db
      .insert(schema.recommendations)
      .values(matched)
      .onConflictDoNothing()
      .returning();

    expect(second).toHaveLength(0);
  });
});
