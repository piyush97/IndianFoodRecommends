import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import { dedupePlaces } from "./dedupe-places";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("dedupePlaces", () => {
  const db = handle?.db as Db;
  let kolkata = 0;
  let mumbai = 0;
  let slugs = 0;
  let videos = 0;

  beforeEach(async () => {
    await truncateAll(db);
    const cities = await db
      .insert(schema.cities)
      .values([
        { slug: "kolkata", name: "Kolkata" },
        { slug: "mumbai", name: "Mumbai" },
      ])
      .returning();
    [kolkata, mumbai] = [cities[0].id, cities[1].id];
    await db.insert(schema.creators).values({ slug: "a", name: "A", ytChannelId: "UC1" });
  });
  afterAll(() => handle?.close());

  /** A place with `picks` approved picks, each from its own video. */
  async function place(name: string, picks = 1, locality: string | null = null, cityId = kolkata) {
    const [row] = await db
      .insert(schema.places)
      .values({ slug: `p${++slugs}`, name, cityId, locality })
      .returning();
    for (let i = 0; i < picks; i++) {
      const [source] = await db
        .insert(schema.sources)
        .values({ platform: "youtube", externalId: `v${++videos}`, creatorId: 1 })
        .returning();
      await db
        .insert(schema.recommendations)
        .values({ sourceId: source.id, placeId: row.id, status: "approved" });
    }
    return row.id;
  }

  const names = async () => (await db.select().from(schema.places)).map((p) => p.name).sort();

  it("lists same-shop pairs without changing anything by default", async () => {
    const arsalan = await place("Arsalan");
    const biryani = await place("Arsalan Biryani", 2);
    await place("Karim's", 1, "Ganganagar");
    await place("Karim's Madhyamgram", 1, "Madhyamgram");
    await place("Arsalan", 1, null, mumbai);

    const plan = await dedupePlaces(db);
    expect(plan).toEqual([
      {
        keep: { id: biryani, name: "Arsalan Biryani", locality: null, picks: 2 },
        merge: [{ id: arsalan, name: "Arsalan", locality: null, picks: 1 }],
      },
    ]);
    expect(await names()).toHaveLength(5);
  });

  it("merges into the place with more picks, then the older one, with --apply", async () => {
    await place("Mann-O-Salwa");
    await place("Mann o Salwa");
    await place("Shadab");
    await place("Hotel Shadab", 2, "Gachibowli");
    await dedupePlaces(db, { apply: true });
    expect(await names()).toEqual(["Hotel Shadab", "Mann-O-Salwa"]);
    const aliases = await db.select().from(schema.placeAliases);
    expect(aliases.map((a) => a.alias).sort()).toEqual(["Mann o Salwa", "Shadab"]);
    expect(await dedupePlaces(db)).toEqual([]);
  });

  it("follows a chain only as far as each place matches the one kept", async () => {
    // "Arsalan" matches both branches, but the branches do not match each other.
    const parkStreet = await place("Arsalan Biryani", 3, "Park Street");
    const saltLake = await place("Arsalan", 2, "Salt Lake");
    const bare = await place("Arsalan");
    const plan = await dedupePlaces(db, { apply: true });
    expect(plan.map((g) => [g.keep.id, g.merge.map((m) => m.id)])).toEqual([[parkStreet, [bare]]]);
    expect((await db.select().from(schema.places)).map((p) => p.id).sort()).toEqual([
      parkStreet,
      saltLake,
    ]);
  });

  it("folds several names of one shop into one place", async () => {
    await place("MTR", 1, "Doddamavalli");
    await place("MTR Lalbagh (Mavalli Tiffin Rooms)", 3, "Doddamavalli, Lal Bagh");
    await place("MTR (Mavalli Tiffin Rooms)", 2, "Doddamavalli");
    const plan = await dedupePlaces(db, { apply: true });
    expect(plan).toHaveLength(1);
    expect(plan[0].merge).toHaveLength(2);
    expect(await names()).toEqual(["MTR Lalbagh (Mavalli Tiffin Rooms)"]);
    const recs = await db.select().from(schema.recommendations);
    expect(new Set(recs.map((r) => r.placeId)).size).toBe(1);
  });
});
