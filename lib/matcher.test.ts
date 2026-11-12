import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { matchDish, matchPlace, samePlace } from "./matcher";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("matcher", () => {
  const db = handle?.db as Db;
  let delhiId = 0;
  let mumbaiId = 0;

  beforeEach(async () => {
    await truncateAll(db);
    const [delhi] = await db
      .insert(schema.cities)
      .values({ slug: "delhi", name: "Delhi", state: "Delhi" })
      .returning();
    const [mumbai] = await db
      .insert(schema.cities)
      .values({ slug: "mumbai", name: "Mumbai", state: "Maharashtra" })
      .returning();
    delhiId = delhi.id;
    mumbaiId = mumbai.id;

    const [place] = await db
      .insert(schema.places)
      .values({ slug: "chache-di-hatti", name: "Chache Di Hatti", cityId: delhiId })
      .returning();
    await db.insert(schema.placeAliases).values({ placeId: place.id, alias: "चाचे दी हट्टी" });
    await db
      .insert(schema.places)
      .values({ slug: "chache-di-hatti-mumbai", name: "Chache Di Hatti", cityId: mumbaiId });

    const [dish] = await db
      .insert(schema.dishes)
      .values({ slug: "chole-bhature", name: "Chole Bhature" })
      .returning();
    await db.insert(schema.dishAliases).values({ dishId: dish.id, alias: "chole bature" });
    await db.insert(schema.dishes).values({ slug: "butter-chicken", name: "Butter Chicken" });
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("matches a misspelled place inside the city", async () => {
    const [match] = await matchPlace(db, "Chachey di Hatti", delhiId);
    expect(match.name).toBe("Chache Di Hatti");
    expect(match.score).toBeGreaterThanOrEqual(0.6);
    expect(match.via).toBe("name");
  });

  it("matches a Devanagari alias", async () => {
    const [match] = await matchPlace(db, "चाचे दी हट्टी", delhiId);
    expect(match.name).toBe("Chache Di Hatti");
    expect(match.via).toBe("alias");
  });

  it("does not match a same-named place in another city", async () => {
    const matches = await matchPlace(db, "Chache Di Hatti", mumbaiId);
    expect(matches.map((m) => m.id)).not.toContain(
      (await db.select().from(schema.places).where(eq(schema.places.slug, "chache-di-hatti")))[0]
        .id,
    );
  });

  it("returns nothing for an unknown name", async () => {
    await expect(matchPlace(db, "Karim's", delhiId)).resolves.toEqual([]);
  });

  it("matches a dish alias", async () => {
    const [match] = await matchDish(db, "chole bature");
    expect(match.name).toBe("Chole Bhature");
  });

  it("normalizes case and extra spaces before comparing", async () => {
    const matches = await matchPlace(db, "  CHACHE   di hatti ", delhiId);
    expect(matches[0].name).toBe("Chache Di Hatti");
  });
});

describe("samePlace", () => {
  type P = { name: string; locality: string | null };
  const p = (name: string, locality: string | null = null): P => ({ name, locality });
  // Real same-city pairs from production.
  const cases: [P, P, boolean][] = [
    [p("Arsalan"), p("Arsalan Biryani"), true],
    [p("Shadab"), p("Hotel Shadab", "Gachibowli"), true],
    [p("Dilruba Cabin", "North Kolkata"), p("Dilruba Restaurant (Cabin)", "North Kolkata"), true],
    [p("Mann-O-Salwa"), p("Mann o Salwa"), true],
    [p("Mahaveer Rabdi Bhandar"), p("Mahaveer Rabri Bhandar", "Masala Chowk"), true],
    [p("Rameshwaram Café"), p("Rameshwaram Cafe", "Indiranagar"), true],
    [p("National Economy"), p("National Economic Restaurant", "North Kolkata"), true],
    [p("MTR", "Doddamavalli"), p("MTR (Mavalli Tiffin Rooms)", "Doddamavalli, Lal Bagh"), true],
    [p("MTR Lalbagh (Mavalli Tiffin Rooms)", "Doddamavalli, Lal Bagh"), p("MTR"), true],
    [p("Karim's", "Ganganagar"), p("Karim's Madhyamgram", "Madhyamgram"), false],
    [p("Dada Boudi", "Madhyamgram"), p("Dada Boudi Biriyani", "Barrackpore"), false],
    [p("Kake Di Hatti", "Chandni Chowk"), p("Kake Da Hotel"), false],
    [p("Vijaya Akka Kadai"), p("Kavitha Akka Kadai"), false],
    [p("Akka Kadai"), p("Vijaya Akka Kadai"), false],
    [p("Rupa Restaurant"), p("India Restaurant"), false],
    [p("Restaurant"), p("Restaurant"), false],
    [p("Biryani", "Anna Nagar"), p("Biryani", "T Nagar"), false],
    [p("Hyderabad House", "Banjara Hills"), p("Hyderabad House", "Kukatpally"), false],
  ];

  it.each(cases)("%o vs %o is %s", (a, b, same) => {
    expect(samePlace(a, b)).toBe(same);
    expect(samePlace(b, a)).toBe(same);
  });
});
