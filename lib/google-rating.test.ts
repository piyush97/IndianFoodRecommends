import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { googleRating, sameName } from "./google-rating";

describe("sameName", () => {
  it.each([
    ["Chache Di Hatti", "Chache Di Hatti", true],
    ["Sita Ram Diwan Chand", "Sitaram Diwan Chand", true],
    ["Haldiram's", "Haldirams", true],
    ["Karim's", "Karim's Jama Masjid", true],
    ["Chache Di Hatti", "Burger King", false],
  ])("%s vs %s", (a, b, same) => {
    expect(sameName(a, b)).toBe(same);
  });
});

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("googleRating", () => {
  const db = handle?.db as Db;
  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.places).values({
      slug: "chache",
      name: "Chache Di Hatti",
      cityId: 1,
      locality: "Kamla Nagar",
      lat: 28.68,
      lng: 77.2,
      osmId: "123",
    });
  });
  afterAll(() => handle?.close());

  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const found = (overrides: object = {}) => ({
    places: [
      {
        id: "ChIJ1",
        displayName: { text: "Chache Di Hatti" },
        location: { latitude: 28.681, longitude: 77.201 },
        rating: 4.3,
        userRatingCount: 2104,
        googleMapsUri: "https://maps.google.com/?cid=1",
        ...overrides,
      },
    ],
  });
  const storedId = async () =>
    (await db.select().from(schema.places).where(eq(schema.places.slug, "chache")))[0]
      .googlePlaceId;

  it("does nothing without a key", async () => {
    const fetchImpl = async () => {
      throw new Error("must not call");
    };
    expect(await googleRating(db, "chache", { apiKey: "", fetchImpl })).toBeNull();
  });

  it("finds the shop once, keeps only its ID, then asks details by ID", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push(String(url));
      if (String(url).endsWith(":searchText")) {
        expect(JSON.parse(String(init.body)).textQuery).toBe("Chache Di Hatti, Kamla Nagar, Delhi");
        return reply(found());
      }
      return reply({
        rating: 4.4,
        userRatingCount: 2110,
        googleMapsUri: "https://maps.google.com/?cid=1",
      });
    }) as typeof fetch;
    expect(await googleRating(db, "chache", { apiKey: "k", fetchImpl })).toEqual({
      rating: 4.3,
      count: 2104,
      url: "https://maps.google.com/?cid=1",
    });
    expect(await storedId()).toBe("ChIJ1");
    expect((await googleRating(db, "chache", { apiKey: "k", fetchImpl }))?.rating).toBe(4.4);
    expect(calls[1]).toBe("https://places.googleapis.com/v1/places/ChIJ1");
  });

  it("marks a far or differently named hit as none and stops asking", async () => {
    let n = 0;
    const far = (async () => {
      n++;
      return reply(found({ location: { latitude: 19.07, longitude: 72.87 } }));
    }) as unknown as typeof fetch;
    expect(await googleRating(db, "chache", { apiKey: "k", fetchImpl: far })).toBeNull();
    expect(await storedId()).toBe("none");
    expect(await googleRating(db, "chache", { apiKey: "k", fetchImpl: far })).toBeNull();
    expect(n).toBe(1);
  });

  it("rejects a near hit with another name", async () => {
    const other = (async () =>
      reply(found({ displayName: { text: "Burger King" } }))) as unknown as typeof fetch;
    expect(await googleRating(db, "chache", { apiKey: "k", fetchImpl: other })).toBeNull();
    expect(await storedId()).toBe("none");
  });

  it("keeps no marker when Google fails, so the next view retries", async () => {
    const down = (async () => reply({ error: "quota" }, 429)) as unknown as typeof fetch;
    expect(await googleRating(db, "chache", { apiKey: "k", fetchImpl: down })).toBeNull();
    expect(await storedId()).toBeNull();
  });
});
