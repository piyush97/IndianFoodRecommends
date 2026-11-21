import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import { agreeTitle, getAgree, getHome } from "./queries";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
const now = new Date("2026-11-06T00:00:00Z");

describe("agreeTitle", () => {
  it("uses the count and city, singular for one", () => {
    expect(agreeTitle(3, "Delhi")).toBe(
      "3 Delhi places that more than one food creator recommends",
    );
    expect(agreeTitle(1, "Delhi")).toBe("1 Delhi place that more than one food creator recommends");
  });
});

describeDb("getAgree", () => {
  const db = handle?.db as Db;

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values([
      { slug: "delhi", name: "Delhi" },
      { slug: "mumbai", name: "Mumbai" },
    ]);
    await db.insert(schema.creators).values([
      { slug: "one", name: "One" },
      { slug: "two", name: "Two" },
      { slug: "three", name: "Three" },
      { slug: "gone", name: "Gone", optedOut: true },
    ]);
    await db.insert(schema.dishes).values([
      { slug: "chole-bhature", name: "Chole Bhature" },
      { slug: "lassi", name: "Lassi" },
    ]);
    // trio: 3 creators; pair-b and pair-a: 2 each, pair-b has more videos; solo: 1 creator, 2 videos;
    // ghost: 1 creator + opted-out one; pend: second creator pending; shut: closed.
    await db.insert(schema.places).values(
      ["trio", "pair-a", "pair-b", "solo", "ghost", "pend", "shut"].map((slug) => ({
        slug,
        name: slug.toUpperCase(),
        cityId: 1,
        ...(slug === "shut" && { status: "closed" as const }),
      })),
    );
    await db.insert(schema.places).values({ slug: "far", name: "FAR", cityId: 2 });
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "o1", creatorId: 1, publishedOn: "2026-11-01" },
      { platform: "youtube", externalId: "o2", creatorId: 1, publishedOn: "2026-11-01" },
      { platform: "youtube", externalId: "t1", creatorId: 2, publishedOn: "2026-11-01" },
      { platform: "youtube", externalId: "h1", creatorId: 3, publishedOn: "2026-11-01" },
      { platform: "youtube", externalId: "g1", creatorId: 4, publishedOn: "2026-11-01" },
    ]);
    const ok = { status: "approved" as const };
    await db.insert(schema.recommendations).values([
      { ...ok, sourceId: 1, placeId: 1, dishId: 1, tsSeconds: 90 },
      { ...ok, sourceId: 1, placeId: 1, dishId: 2, tsSeconds: 120 },
      { ...ok, sourceId: 3, placeId: 1, dishId: 1 },
      { ...ok, sourceId: 4, placeId: 1, dishId: 2 },
      { ...ok, sourceId: 1, placeId: 2, dishId: 1 },
      { ...ok, sourceId: 3, placeId: 2, dishId: 1 },
      { ...ok, sourceId: 1, placeId: 3, dishId: 1 },
      { ...ok, sourceId: 2, placeId: 3, dishId: 1 },
      { ...ok, sourceId: 3, placeId: 3, dishId: 1 },
      { ...ok, sourceId: 1, placeId: 4, dishId: 1 },
      { ...ok, sourceId: 2, placeId: 4, dishId: 1 },
      { ...ok, sourceId: 1, placeId: 5, dishId: 1 },
      { ...ok, sourceId: 5, placeId: 5, dishId: 1 },
      { ...ok, sourceId: 1, placeId: 6, dishId: 1 },
      { status: "pending", sourceId: 3, placeId: 6, dishId: 1 },
      { ...ok, sourceId: 1, placeId: 7, dishId: 1 },
      { ...ok, sourceId: 3, placeId: 7, dishId: 1 },
      { ...ok, sourceId: 1, placeId: 8, dishId: 1 },
      { ...ok, sourceId: 3, placeId: 8, dishId: 1 },
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("lists only places with 2+ approved, visible creators, most creators first, then card ties", async () => {
    const data = await getAgree(db, "delhi", now);
    expect(data?.places.map((p) => p.placeSlug)).toEqual(["trio", "pair-b", "pair-a"]);
  });

  it("gives each creator the dishes they ordered with the video moment", async () => {
    const trio = (await getAgree(db, "delhi", now))!.places[0];
    expect(trio.creators.map((c) => c.slug).sort()).toEqual(["one", "three", "two"]);
    expect(trio.creators.find((c) => c.slug === "one")!.picks).toEqual([
      { dish: "Chole Bhature", platform: "youtube", externalId: "o1", tsSeconds: 90 },
      { dish: "Lassi", platform: "youtube", externalId: "o1", tsSeconds: 120 },
    ]);
  });

  it("counts the same places on the home page and returns null for an unknown city", async () => {
    expect((await getHome(db, "delhi", now))?.agreeCount).toBe(3);
    expect((await getAgree(db, "mumbai", now))?.places.map((p) => p.placeSlug)).toEqual(["far"]);
    expect(await getAgree(db, "nowhere", now)).toBeNull();
  });
});
