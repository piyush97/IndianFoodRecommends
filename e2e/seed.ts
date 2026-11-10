import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { truncateAll } from "../db/test-db";
import { readLocalities, syncAreas } from "../lib/areas";
import { refreshWalks, refreshHeatmap } from "../lib/worker/geo";

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
      .values({ slug: "chole-bhature", name: "Chole Bhature", diet: "veg" })
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
    // A second creator's pick about 220 m from Chache Di Hatti, so its place page has a nearby pick.
    const [other] = await db
      .insert(schema.creators)
      .values({
        slug: "nearby-creator",
        name: "Nearby Creator",
        ytChannelId: "UCnearbycreator000000000",
      })
      .returning();
    const [tikka] = await db
      .insert(schema.dishes)
      .values({ slug: "paneer-tikka", name: "Paneer Tikka", diet: "veg" })
      .returning();
    const [otherSource] = await db
      .insert(schema.sources)
      .values({
        platform: "youtube",
        externalId: "9bZkp7q19f0",
        creatorId: other.id,
        publishedOn: "2026-11-02",
      })
      .returning();
    const [nearby] = await db
      .insert(schema.places)
      .values({
        slug: "kamla-nagar-dhaba",
        name: "Kamla Nagar Dhaba",
        cityId: city.id,
        locality: "Kamla Nagar",
        lat: 28.682,
        lng: 77.21,
      })
      .returning();
    await db.insert(schema.recommendations).values([
      {
        sourceId: source.id,
        placeId: place.id,
        dishId: dish.id,
        tsSeconds: 252,
        status: "approved",
        origin: "manual",
      },
      {
        sourceId: otherSource.id,
        placeId: nearby.id,
        dishId: tikka.id,
        tsSeconds: 300,
        status: "approved",
        origin: "manual",
      },
    ]);
    // Trust and near-me fixtures: a closed place, a flagged place (3 distinct reporters) and a
    // pin next to Chandni Chowk (28.656, 77.23), all with approved picks from their own creator.
    const [street] = await db
      .insert(schema.creators)
      .values({ slug: "street-eats", name: "Street Eats" })
      .returning();
    const [golGappe] = await db
      .insert(schema.dishes)
      .values({ slug: "gol-gappe", name: "Gol Gappe", diet: "veg" })
      .returning();
    const [streetSource] = await db
      .insert(schema.sources)
      .values({
        platform: "youtube",
        externalId: "streetEats01",
        creatorId: street.id,
        publishedOn: "2026-10-20",
      })
      .returning();
    const [chandni, closed, flagged] = await db
      .insert(schema.places)
      .values([
        {
          slug: "chandni-chowk-chaat",
          name: "Chandni Chowk Chaat",
          cityId: city.id,
          locality: "Chandni Chowk",
          lat: 28.6562,
          lng: 77.2303,
        },
        {
          slug: "closed-chaat-corner",
          name: "Closed Chaat Corner",
          cityId: city.id,
          lat: 28.57,
          lng: 77.32,
          status: "closed",
          statusChangedAt: new Date("2026-09-15T00:00:00Z"),
        },
        {
          slug: "flagged-sweet-shop",
          name: "Flagged Sweet Shop",
          cityId: city.id,
          lat: 28.54,
          lng: 77.24,
        },
      ])
      .returning();
    await db.insert(schema.recommendations).values(
      [chandni, closed, flagged].map((p) => ({
        sourceId: streetSource.id,
        placeId: p.id,
        dishId: golGappe.id,
        tsSeconds: 60,
        status: "approved" as const,
        origin: "manual" as const,
      })),
    );
    await db.insert(schema.reports).values(
      ["hash-a", "hash-b", "hash-c"].map((ipHash) => ({
        placeId: flagged.id,
        kind: "closed",
        ipHash,
      })),
    );
    await syncAreas(db, await readLocalities(db));
    // Labelled synthetic city fixtures exercise the >300-pin tile path and five-stop walks.
    const [tileCity] = await db
      .insert(schema.cities)
      .values({ slug: "jaipur", name: "Jaipur" })
      .returning();
    const [tileCreator] = await db
      .insert(schema.creators)
      .values({ slug: "tile-fixture", name: "Tile Fixture Creator" })
      .returning();
    const [tileSource] = await db
      .insert(schema.sources)
      .values({ platform: "youtube", externalId: "fixture0001", creatorId: tileCreator.id })
      .returning();
    const [tileDish] = await db
      .insert(schema.dishes)
      .values({ slug: "tile-fixture", name: "Tile Fixture Dish" })
      .returning();
    const tilePlaces = await db
      .insert(schema.places)
      .values(
        Array.from({ length: 301 }, (_, i) => ({
          cityId: tileCity.id,
          slug: `tile-fixture-${i}`,
          name: `Tile Fixture ${i}`,
          locality: "Test fixtures",
          lat: 26.91 + Math.floor(i / 21) * 0.0001,
          lng: 75.78 + (i % 21) * 0.0001,
          osmId: `node/${i + 1000}`,
        })),
      )
      .returning({ id: schema.places.id });
    await db.insert(schema.recommendations).values(
      tilePlaces.map((p) => ({
        placeId: p.id,
        sourceId: tileSource.id,
        dishId: tileDish.id,
        status: "approved" as const,
        origin: "manual" as const,
      })),
    );
    await refreshWalks(db);
    await refreshHeatmap(db);
    console.log("e2e seed ok");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
