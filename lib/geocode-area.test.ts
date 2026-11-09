import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { syncAreas, type LocalityRow } from "./areas";
import { findArea, UpstreamBusy } from "./geocode-area";

const hit = (lat: number, lng: number) => async () => ({ lat, lng, osmId: "1", displayName: "x" });
const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describe("findArea input checks", () => {
  const never = async () => {
    throw new Error("must not geocode");
  };
  it("rejects an unknown city and a too short or too long query", async () => {
    const db = {} as Db;
    for (const [city, q] of [
      ["atlantis", "cp"],
      ["delhi", "a"],
      ["delhi", "x".repeat(81)],
    ]) {
      expect(await findArea(db, city, q, never)).toMatchObject({ ok: false, status: 400 });
    }
  });
});

const locality = (name: string, lat: number, lng: number): LocalityRow => ({
  city: "delhi",
  locality: name,
  n: 1,
  pinned: 1,
  lat,
  lng,
});

describeDb("findArea", () => {
  const db = handle?.db as Db;
  const upstreamMustNotRun = async () => {
    throw new Error("upstream must not be called");
  };
  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.places).values([
      { slug: "a", name: "A", cityId: 1, lat: 28.6, lng: 77.2, osmId: "approx:1" },
      { slug: "b", name: "B", cityId: 1, lat: 28.7, lng: 77.1, osmId: "approx:2" },
    ]);
    await syncAreas(
      db,
      [
        locality("Chandni Chowk", 28.656, 77.23),
        locality("Connaught Place", 28.63, 77.22),
        locality("Karol Bagh", 28.65, 77.19),
      ],
      [{ city: "delhi", area: "Connaught Place", aliases: ["CP"] }],
    );
  });
  afterAll(() => handle?.close());

  it("answers from our own areas, nicknames and misspellings without calling upstream", async () => {
    for (const [typed, name] of [
      ["Connaught Place", "Connaught Place"],
      ["  cp ", "Connaught Place"],
      ["chandini chowk", "Chandni Chowk"],
      ["karol bagh market delhi", "Karol Bagh"],
    ]) {
      const res = await findArea(db, "delhi", typed, upstreamMustNotRun);
      expect(res).toMatchObject({ ok: true, label: name, via: "local" });
    }
  });

  it("asks OpenStreetMap for the text plus the city name when no area is close", async () => {
    let asked = "";
    const res = await findArea(db, "delhi", "Hauz Khas", async (q) => {
      asked = q;
      return { lat: 28.55, lng: 77.2, osmId: "1", displayName: "Hauz Khas, Delhi" };
    });
    expect(asked).toBe("Hauz Khas, Delhi");
    expect(res).toEqual({
      ok: true,
      lat: 28.55,
      lng: 77.2,
      label: "Hauz Khas",
      via: "openstreetmap",
    });
  });

  it("keeps an upstream answer, so the same text is local next time", async () => {
    const res = await findArea(db, "delhi", "Hauz Khas", upstreamMustNotRun);
    expect(res).toMatchObject({ ok: true, via: "local" });
  });

  it("answers 404 with close names when nothing is found or the hit is in another town", async () => {
    expect(await findArea(db, "delhi", "zzzz", async () => null)).toMatchObject({ status: 404 });
    // Mumbai is about 1150 km from Delhi.
    expect(await findArea(db, "delhi", "Bandra", hit(19.06, 72.83))).toMatchObject({ status: 404 });
    const near = await findArea(db, "delhi", "chandni chok bazaar", async () => null);
    expect(near).toMatchObject({ ok: false, status: 404 });
    if (!near.ok) expect(near.suggestions.map((s) => s.name)).toContain("Chandni Chowk");
  });

  it("answers 502 or 429 only when there is nothing local to offer", async () => {
    const boom = async () => {
      throw new Error("down");
    };
    expect(await findArea(db, "delhi", "Saket", boom)).toMatchObject({ status: 502 });
    const busy = async () => {
      throw new UpstreamBusy();
    };
    expect(await findArea(db, "delhi", "Saket", busy)).toMatchObject({ status: 429 });
    // With a close local name the visitor gets choices instead of an error.
    expect(await findArea(db, "delhi", "chandni chok bazaar", boom)).toMatchObject({ status: 404 });
  });
});
