import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { truncateAll } from "../db/test-db";

/** Wipes DATABASE_URL and inserts one approved pick for the E2E flow. Never point at prod. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || /neon\.tech|vercel/.test(url))
    throw new Error("e2e seed refuses a missing or hosted DATABASE_URL");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });
  try {
    await truncateAll(db);
    const [city] = await db
      .insert(schema.cities)
      .values({ slug: "delhi", name: "Delhi" })
      .returning();
    const [creator] = await db
      .insert(schema.creators)
      .values({ slug: "e2e-creator", name: "E2E Creator", ytChannelId: "UCe2e0000000000000000000" })
      .returning();
    const [dish] = await db
      .insert(schema.dishes)
      .values({ slug: "chole-bhature", name: "Chole Bhature" })
      .returning();
    await db.insert(schema.dishAliases).values({ dishId: dish.id, alias: "chole bature" });
    const [place] = await db
      .insert(schema.places)
      .values({
        slug: "chache-di-hatti",
        name: "Chache Di Hatti",
        cityId: city.id,
        locality: "Kamla Nagar",
        lat: 28.68,
        lng: 77.21,
      })
      .returning();
    const [source] = await db
      .insert(schema.sources)
      .values({
        platform: "youtube",
        externalId: "dQw4w9WgXcQ",
        creatorId: creator.id,
        publishedOn: "2026-11-01",
      })
      .returning();
    await db.insert(schema.recommendations).values({
      sourceId: source.id,
      placeId: place.id,
      dishId: dish.id,
      tsSeconds: 252,
      status: "approved",
      origin: "manual",
    });
    console.log("e2e seed ok");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
