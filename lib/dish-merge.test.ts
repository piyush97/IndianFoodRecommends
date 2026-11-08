import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { dishDuplicates } from "./dish-dupes";
import { matchDish } from "./matcher";
import { mergeDishes } from "./review";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("dish canonicalisation", () => {
  const db = handle?.db as Db;
  let plain = 0;
  let fancy = 0;

  beforeEach(async () => {
    await truncateAll(db);
    const [city] = await db
      .insert(schema.cities)
      .values({ slug: "delhi", name: "Delhi", state: "Delhi" })
      .returning();
    const [creator] = await db
      .insert(schema.creators)
      .values({ slug: "a", name: "A", ytChannelId: "UC1" })
      .returning();
    const [video] = await db
      .insert(schema.sources)
      .values({ platform: "youtube", externalId: "v1", creatorId: creator.id })
      .returning();
    const [place] = await db
      .insert(schema.places)
      .values({ slug: "p", name: "P", cityId: city.id })
      .returning();
    const dishes = await db
      .insert(schema.dishes)
      .values([
        { slug: "chole-bhature", name: "Chole Bhature" },
        { slug: "desi-ghee-chole-bhature", name: "Desi Ghee Chole Bhature" },
        { slug: "ghee-roast", name: "Ghee Roast" },
      ])
      .returning();
    [plain, fancy] = [dishes[0].id, dishes[1].id];
    // Same video + place under both names, plus a second timestamp only on the variant.
    await db.insert(schema.recommendations).values([
      { sourceId: video.id, placeId: place.id, dishId: plain, tsSeconds: 10, status: "approved" },
      { sourceId: video.id, placeId: place.id, dishId: fancy, tsSeconds: 10, status: "approved" },
      { sourceId: video.id, placeId: place.id, dishId: fancy, tsSeconds: 99, status: "approved" },
    ]);
  });
  afterAll(() => handle?.close());

  it("matches a qualified name to the plain dish", async () => {
    const [best] = await matchDish(db, "Famous Chole Bhature");
    expect(best).toMatchObject({ id: plain, score: 1 });
  });

  it("lists the variant, not a one-word qualifier like Ghee Roast", async () => {
    const dupes = await dishDuplicates(db);
    expect(dupes.map((d) => [d.from.name, d.into.name])).toEqual([
      ["Desi Ghee Chole Bhature", "Chole Bhature"],
    ]);
    expect(dupes[0].from.picks).toBe(2);
  });

  it("merges: picks move, the duplicate pick is dropped, the name stays searchable as an alias", async () => {
    await mergeDishes(db, fancy, plain);
    const picks = await db.select().from(schema.recommendations);
    expect(picks.map((r) => [r.dishId, r.tsSeconds]).sort()).toEqual([
      [plain, 10],
      [plain, 99],
    ]);
    expect((await db.select().from(schema.dishes)).map((d) => d.name).sort()).toEqual([
      "Chole Bhature",
      "Ghee Roast",
    ]);
    expect((await db.select().from(schema.dishAliases)).map((a) => a.alias)).toEqual([
      "Desi Ghee Chole Bhature",
    ]);
    expect(await dishDuplicates(db)).toEqual([]);
    await expect(mergeDishes(db, plain, plain)).rejects.toThrow();
  });
});
