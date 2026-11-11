import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import {
  getCity,
  getCreator,
  getDishInCity,
  getAllCards,
  getDishPicks,
  getHome,
  getListCards,
  getPlace,
  getPlaceCards,
  listActiveCities,
} from "./queries";
import { nearbyPlaces } from "../geo";
import { searchAll } from "./search";
import { getSpatialPicks } from "./spatial";

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
      { slug: "closedonly", name: "Closedonlyvlogger" },
    ]);
    await db.insert(schema.dishes).values([
      { slug: "chole-bhature", name: "Chole Bhature", diet: "veg" },
      { slug: "momos", name: "Momos", diet: "non-veg" },
      { slug: "zorbadish", name: "Zorbadish", diet: "veg" },
    ]);
    await db.insert(schema.places).values([
      { slug: "a", name: "Alpha", cityId: 1, lat: 28.6, lng: 77.2, osmId: "approx:1" },
      { slug: "b", name: "Bravo", cityId: 1 },
      { slug: "c", name: "Charlie", cityId: 1 },
      { slug: "d", name: "Delta", cityId: 1 },
      // Closed 55 m from Alpha; its only pick is by a creator and dish nothing else uses.
      {
        slug: "e",
        name: "Echoplace",
        cityId: 1,
        lat: 28.6005,
        lng: 77.2,
        osmId: "node/5",
        status: "closed",
        statusChangedAt: new Date("2026-10-15T00:00:00Z"),
      },
    ]);
    // sources: v1,v2 by One; v3 by Two; v4 by Gone; v5 by Closedonly
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "v1", creatorId: 1, publishedOn: "2026-11-01" },
      { platform: "youtube", externalId: "v2", creatorId: 1, publishedOn: "2026-10-01" },
      { platform: "youtube", externalId: "v3", creatorId: 2, publishedOn: "2026-09-01" },
      { platform: "youtube", externalId: "v4", creatorId: 3, publishedOn: "2026-11-02" },
      { platform: "youtube", externalId: "v5", creatorId: 4, publishedOn: "2026-08-01" },
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
      { ...ok, sourceId: 5, placeId: 5, dishId: 3 }, // Echoplace (closed) by Closedonly
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

  it("merges dish variants and ranks the place more creators picked first", async () => {
    const cards = await getDishPicks(db, ["momos", "chole-bhature"], now);
    // Alpha: One + Two (2 creators) beats Bravo: Two only, though Bravo shares a creator.
    expect(cards.map((c) => [c.placeSlug, c.creators.length])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
    expect(cards[0].pickedOn).toBe("2026-11-01");
    expect(await getDishPicks(db, [], now)).toEqual([]);
  });

  it("filters rows by diet, so creator counts only count that diet", async () => {
    const dishes = ["momos", "chole-bhature"];
    const veg = await getDishPicks(db, dishes, now, "veg");
    expect(veg.map((c) => [c.placeSlug, c.creators.length])).toEqual([["a", 2]]);
    const nonVeg = await getDishPicks(db, dishes, now, "non-veg");
    expect(nonVeg.map((c) => [c.placeSlug, c.creators.length])).toEqual([["b", 1]]);
    const city = await getCity(db, "delhi", now, "non-veg");
    expect(city?.places.map((p) => p.placeSlug)).toEqual(["b"]);
    expect(city?.dishes.map((d) => d.slug)).toEqual(["momos"]);
    expect((await getPlaceCards(db, ["a", "b"], now, "veg")).map((c) => c.placeSlug)).toEqual([
      "a",
    ]);
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

  it("builds the near-me index from visible picks only", async () => {
    const cards = await getAllCards(db, now);
    expect(cards.map((c) => c.placeSlug).sort()).toEqual(["a", "b"]);
    const alpha = cards.find((c) => c.placeSlug === "a");
    expect(alpha?.creators.map((c) => c.slug).sort()).toEqual(["one", "two"]);
  });

  describe("a place confirmed closed", () => {
    it("drops out of city, home, dish, creator and near-me lists", async () => {
      const city = await getCity(db, "delhi", now);
      expect(city?.places.map((p) => p.placeSlug)).not.toContain("e");
      expect(city?.dishes.map((d) => d.slug)).not.toContain("zorbadish");
      const home = await getHome(db, "delhi", now);
      expect([...home!.top, ...home!.recent].map((p) => p.placeSlug)).not.toContain("e");
      expect(home?.creators.map((c) => c.slug)).not.toContain("closedonly");
      expect((await getDishInCity(db, "delhi", "zorbadish", now))?.places).toEqual([]);
      expect((await getDishPicks(db, ["zorbadish"], now)).map((c) => c.placeSlug)).toEqual([]);
      expect(await getPlaceCards(db, ["e"], now)).toEqual([]);
      expect((await getAllCards(db, now)).map((c) => c.placeSlug)).not.toContain("e");
      expect(await listActiveCities(db)).toEqual([{ slug: "delhi", name: "Delhi", picks: 4 }]);
    });

    it("leaves the creator page without it", async () => {
      const creator = await getCreator(db, "closedonly", undefined, now);
      expect(creator?.picks).toEqual([]);
      expect(creator?.dishes).toEqual([]);
      expect(creator?.total).toBe(0);
    });

    it("stays reachable on its own page, marked closed", async () => {
      const place = await getPlace(db, "delhi", "e", now);
      expect(place?.place).toMatchObject({ slug: "e", status: "closed" });
      expect(place?.place.statusChangedAt).toBe("2026-10-15T00:00:00.000Z");
      expect(place?.proofs).toHaveLength(1);
      expect((await getPlace(db, "delhi", "a", now))?.place.status).toBe("open");
    });

    it("stays on a shared list, labelled, next to open places", async () => {
      const cards = await getListCards(db, ["e", "a"], now);
      expect(cards.map((c) => c.placeSlug).sort()).toEqual(["a", "e"]);
      const closed = cards.find((c) => c.placeSlug === "e");
      expect(closed).toMatchObject({
        status: "closed",
        statusChangedAt: "2026-10-15T00:00:00.000Z",
        flagged: false,
      });
      expect(cards.find((c) => c.placeSlug === "a")).toMatchObject({
        status: "open",
        statusChangedAt: null,
      });
    });

    it("does not surface in search, including through its dish and creator", async () => {
      expect((await searchAll(db, "Echoplace")).places).toEqual([]);
      expect((await searchAll(db, "Zorbadish")).dishes).toEqual([]);
      expect((await searchAll(db, "Closedonlyvlogger")).creators).toEqual([]);
      expect((await searchAll(db, "Alpha")).places.map((p) => p.slug)).toEqual(["a"]);
    });

    it("does not surface in area or viewport results", async () => {
      const near = await getSpatialPicks(db, "delhi", { near: { lat: 28.6, lng: 77.2 } });
      expect(near.map((c) => c.placeSlug)).toEqual(["a"]);
      const box = await getSpatialPicks(db, "delhi", { bbox: [77.1, 28.5, 77.3, 28.7] });
      expect(box.map((c) => c.placeSlug)).toEqual(["a"]);
    });

    it("is not listed as a nearby place", async () => {
      const near = await nearbyPlaces(db, { lat: 28.6, lng: 77.2, radiusKm: 1.5, limit: 8 });
      expect(near.map((n) => n.slug)).toEqual(["a"]);
      expect((await getPlace(db, "delhi", "a", now))?.nearby).toEqual([]);
    });

    it("keeps moved places listed, and flags places with 3 distinct reporters", async () => {
      await db.update(schema.places).set({ status: "moved" }).where(eq(schema.places.slug, "b"));
      await db
        .insert(schema.reports)
        .values(["h1", "h2", "h3"].map((ipHash) => ({ placeId: 2, kind: "moved", ipHash })));
      const [b] = await getPlaceCards(db, ["b"], now);
      expect(b).toMatchObject({ status: "moved", flagged: true, flagKind: "moved" });
      expect((await getCity(db, "delhi", now))?.places.map((p) => p.placeSlug)).toContain("b");
      const [a] = await getPlaceCards(db, ["a"], now);
      expect(a).toMatchObject({ status: "open", flagged: false });
      expect((await getPlace(db, "delhi", "b", now))?.place).toMatchObject({
        status: "moved",
        flagged: true,
        flagKind: "moved",
      });
      await db.update(schema.places).set({ status: "open" }).where(eq(schema.places.slug, "b"));
      await db.delete(schema.reports);
    });
  });
});
