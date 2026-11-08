import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { findArea } from "./geocode-area";

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

describeDb("findArea", () => {
  const db = handle?.db as Db;
  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.places).values([
      { slug: "a", name: "A", cityId: 1, lat: 28.6, lng: 77.2, osmId: "approx:1" },
      { slug: "b", name: "B", cityId: 1, lat: 28.7, lng: 77.1, osmId: "approx:2" },
    ]);
  });
  afterAll(() => handle?.close());

  it("returns coordinates near the city and labels them with the typed text", async () => {
    const res = await findArea(db, "delhi", "  Connaught   Place ", hit(28.63, 77.22));
    expect(res).toEqual({ ok: true, lat: 28.63, lng: 77.22, label: "Connaught Place" });
  });

  it("asks OpenStreetMap for the text plus the city name", async () => {
    let asked = "";
    await findArea(db, "delhi", "Hauz Khas", async (q) => {
      asked = q;
      return null;
    });
    expect(asked).toBe("Hauz Khas, Delhi");
  });

  it("answers 404 when nothing is found or the hit is in another town", async () => {
    expect(await findArea(db, "delhi", "zzzz", async () => null)).toMatchObject({ status: 404 });
    // Mumbai is about 1150 km from Delhi.
    expect(await findArea(db, "delhi", "Bandra", hit(19.06, 72.83))).toMatchObject({ status: 404 });
  });

  it("answers 502 when the search service fails", async () => {
    const boom = async () => {
      throw new Error("down");
    };
    expect(await findArea(db, "delhi", "Saket", boom)).toMatchObject({ status: 502 });
  });
});
