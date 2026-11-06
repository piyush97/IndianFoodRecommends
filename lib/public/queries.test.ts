import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import {
  getCreator,
  getDishInCity,
  getHome,
  getPlace,
  getPlaceCards,
  listActiveCities,
} from "./queries";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
const now = new Date("2026-11-06T00:00:00Z");

describeDb("public queries", () => {
  const db = handle?.db as Db;

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values([
      { slug: "one", name: "One" },
      { slug: "two", name: "Two" },
      { slug: "gone", name: "Gone", optedOut: true },
    ]);
    await db.insert(schema.dishes).values([
      { slug: "chole-bhature", name: "Chole Bhature" },
      { slug: "momos", name: "Momos" },
    ]);
    await db.insert(schema.places).values([
      { slug: "a", name: "Alpha", cityId: 1, lat: 28.6, lng: 77.2, osmId: "approx:1" },
      { slug: "b", name: "Bravo", cityId: 1 },
      { slug: "c", name: "Charlie", cityId: 1 },
      { slug: "d", name: "Delta", cityId: 1 },
    ]);
    // sources: v1,v2 by One; v3 by Two; v4 by Gone
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "v1", creatorId: 1, publishedOn: "2026-11-01" },
      { platform: "youtube", externalId: "v2", creatorId: 1, publishedOn: "2026-10-01" },
      { platform: "youtube", externalId: "v3", creatorId: 2, publishedOn: "2026-09-01" },
      { platform: "youtube", externalId: "v4", creatorId: 3, publishedOn: "2026-11-02" },
    ]);
    const ok = { status: "approved" as const, dishId: 1 };
    await db.insert(schema.recommendations).values([
      { ...ok, sourceId: 1, placeId: 1, tsSeconds: 252 }, // Alpha by One
      { ...ok, sourceId: 2, placeId: 1 }, // Alpha by One again
      { ...ok, sourceId: 3, placeId: 1 }, // Alpha by Two
      { ...ok, sourceId: 3, placeId: 2, dishId: 2 }, // Bravo momos by Two
      { ...ok, sourceId: 4, placeId: 1, tsSeconds: 9 }, // Alpha by Gone (opted out)
      { status: "pending", sourceId: 1, placeId: 3, dishId: 1 }, // Charlie pending
      { ...ok, sourceId: 4, placeId: 4 }, // Delta only by Gone
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("ranks places by distinct visible creators and hides pending and opted-out", async () => {
    const res = await getDishInCity(db, "delhi", "chole-bhature", now);
    expect(res?.places.map((p) => p.placeSlug)).toEqual(["a"]);
    expect(res?.places[0].creators.map((c) => c.slug).sort()).toEqual(["one", "two"]);
    expect(res?.places[0].approx).toBe(true);
    expect(res?.places[0].proof).toMatchObject({ externalId: "v1", tsSeconds: 252 });
    expect(res?.creatorCount).toBe(2);
  });

  it("counts only visible approved picks on the home page", async () => {
    const home = await getHome(db, "delhi", now);
    const chole = home?.dishes.find((d) => d.slug === "chole-bhature");
    expect(chole?.picks).toBe(3);
    expect(home?.creators.map((c) => c.slug)).not.toContain("gone");
    expect(home?.recent.map((p) => p.placeSlug)).not.toContain("d");
  });

  it("gives the home page the city's top places by rank", async () => {
    const home = await getHome(db, "delhi", now);
    expect(home?.top.map((p) => p.placeSlug)).toEqual(["a", "b"]);
  });

  it("builds ranked cards for a set of place slugs, skipping hidden places", async () => {
    const cards = await getPlaceCards(db, ["b", "a", "d", "nope"], now);
    expect(cards.map((c) => c.placeSlug)).toEqual(["a", "b"]);
    expect(cards[0]).toMatchObject({ citySlug: "delhi", proof: { externalId: "v1" } });
  });

  it("returns null for a place with no visible picks", async () => {
    expect(await getPlace(db, "delhi", "c")).toBeNull();
    expect(await getPlace(db, "delhi", "d")).toBeNull();
  });

  it("lists proofs without the opted-out creator", async () => {
    const place = await getPlace(db, "delhi", "a");
    expect(place?.proofs.map((p) => p.creator.slug)).not.toContain("gone");
    expect(place?.dishes).toEqual([{ slug: "chole-bhature", name: "Chole Bhature", creators: 2 }]);
  });

  it("hides an opted-out creator and filters by dish", async () => {
    expect(await getCreator(db, "gone")).toBeNull();
    const two = await getCreator(db, "two", "momos");
    expect(two?.picks.map((p) => p.placeSlug)).toEqual(["b"]);
    expect(two?.picks[0].citySlug).toBe("delhi");
  });

  it("lists every city that has visible picks", async () => {
    expect(await listActiveCities(db)).toEqual([{ slug: "delhi", name: "Delhi", picks: 4 }]);
  });

  it("returns null for unknown slugs", async () => {
    expect(await getHome(db, "mumbai", now)).toBeNull();
    expect(await getDishInCity(db, "delhi", "pizza", now)).toBeNull();
    expect(await getPlace(db, "delhi", "nope")).toBeNull();
    expect(await getCreator(db, "nobody")).toBeNull();
  });
});
