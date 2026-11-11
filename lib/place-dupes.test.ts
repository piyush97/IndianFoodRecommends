import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { placeDuplicates } from "./place-dupes";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("place duplicates", () => {
  const db = handle?.db as Db;
  let delhi = 0;
  let mumbai = 0;
  let video = 0;
  let optedOutVideo = 0;
  let slugs = 0;

  beforeEach(async () => {
    await truncateAll(db);
    const cities = await db
      .insert(schema.cities)
      .values([
        { slug: "delhi", name: "Delhi", state: "Delhi" },
        { slug: "mumbai", name: "Mumbai", state: "Maharashtra" },
      ])
      .returning();
    [delhi, mumbai] = [cities[0].id, cities[1].id];
    const creators = await db
      .insert(schema.creators)
      .values([
        { slug: "a", name: "A", ytChannelId: "UC1" },
        { slug: "b", name: "B", ytChannelId: "UC2", optedOut: true },
      ])
      .returning();
    const sources = await db
      .insert(schema.sources)
      .values([
        { platform: "youtube", externalId: "v1", creatorId: creators[0].id },
        { platform: "youtube", externalId: "v2", creatorId: creators[1].id },
      ])
      .returning();
    [video, optedOutVideo] = [sources[0].id, sources[1].id];
  });
  afterAll(() => handle?.close());

  /** A Delhi place with one approved pick by the visible creator, unless told otherwise. */
  async function place(
    name: string,
    {
      picks = 1,
      sourceId = video,
      ...values
    }: {
      picks?: number;
      sourceId?: number;
      cityId?: number;
      locality?: string;
      status?: "open" | "closed" | "moved";
    } = {},
  ): Promise<number> {
    const [row] = await db
      .insert(schema.places)
      .values({ slug: `p${++slugs}`, name, cityId: delhi, ...values })
      .returning();
    if (picks > 0) {
      await db.insert(schema.recommendations).values(
        Array.from({ length: picks }, () => ({
          sourceId,
          placeId: row.id,
          status: "approved" as const,
        })),
      );
    }
    return row.id;
  }

  it("returns a near-identical pair in one city once, with its visible pick counts", async () => {
    const a = await place("Mann-O-Salwa", { locality: "Jama Masjid", picks: 2 });
    const b = await place("Mann O Salwa");
    // Not counted: a pending pick and a pick by an opted-out creator.
    await db.insert(schema.recommendations).values([
      { sourceId: video, placeId: b },
      { sourceId: optedOutVideo, placeId: b, status: "approved" },
    ]);
    expect(await placeDuplicates(db)).toEqual([
      {
        a: { id: a, name: "Mann-O-Salwa", locality: "Jama Masjid", picks: 2 },
        b: { id: b, name: "Mann O Salwa", locality: null, picks: 1 },
      },
    ]);
  });

  it("does not pair two different names in the same city", async () => {
    await place("Mann-O-Salwa");
    await place("Karim's");
    expect(await placeDuplicates(db)).toEqual([]);
  });

  it("does not pair a place with no approved picks", async () => {
    await place("Mann-O-Salwa");
    const pending = await place("Mann O Salwa", { picks: 0 });
    await db.insert(schema.recommendations).values({ sourceId: video, placeId: pending });
    expect(await placeDuplicates(db)).toEqual([]);
  });

  it("does not pair a place whose only creator opted out", async () => {
    await place("Mann-O-Salwa");
    await place("Mann O Salwa", { sourceId: optedOutVideo });
    expect(await placeDuplicates(db)).toEqual([]);
  });

  it("does not pair a closed place", async () => {
    await place("Mann-O-Salwa");
    await place("Mann O Salwa", { status: "closed" });
    expect(await placeDuplicates(db)).toEqual([]);
  });

  it("does not pair the same name in different cities", async () => {
    await place("Mann-O-Salwa");
    await place("Mann-O-Salwa", { cityId: mumbai });
    expect(await placeDuplicates(db)).toEqual([]);
  });

  it("lists the closest names first, then by name", async () => {
    await place("Zed Cafe");
    await place("ZED CAFE");
    await place("Aaa Sweets");
    await place("Aaa Sweet");
    await place("Mann-O-Salwa");
    await place("Mann O Salwa");
    const dupes = await placeDuplicates(db);
    expect(dupes.map((d) => [d.a.name, d.b.name])).toEqual([
      ["Mann-O-Salwa", "Mann O Salwa"],
      ["Zed Cafe", "ZED CAFE"],
      ["Aaa Sweets", "Aaa Sweet"],
    ]);
  });
});
