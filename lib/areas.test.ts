import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import {
  ACCEPT,
  areaKey,
  buildAreas,
  editDistance,
  matchAreas,
  rememberUpstream,
  scoreKey,
  skeleton,
  suggestionsFrom,
  syncAreas,
  withoutCity,
  type AreaHit,
  type LocalityRow,
} from "./areas";

const row = (city: string, locality: string, n = 1, lat = 28.6, lng = 77.2): LocalityRow => ({
  city,
  locality,
  n,
  pinned: n,
  lat,
  lng,
});

describe("areaKey", () => {
  it("folds case, punctuation and diacritics, and joins single letters", () => {
    expect(areaKey("K.K.Nagar")).toBe("kk nagar");
    expect(areaKey("K K Nagar")).toBe("kk nagar");
    expect(areaKey("M G Road")).toBe("mg road");
    expect(areaKey("  Café   Street ")).toBe("cafe street");
    expect(areaKey("GK-2")).toBe("gk 2");
    expect(areaKey("चांदनी चौक")).toBe("चांदनी चौक");
  });
});

describe("withoutCity", () => {
  it("drops the city name from either end but never empties the query", () => {
    expect(withoutCity("Fort Mumbai", "mumbai", "Mumbai")).toBe("fort");
    expect(withoutCity("bombay fort", "mumbai", "Mumbai")).toBe("fort");
    expect(withoutCity("Mumbai", "mumbai", "Mumbai")).toBe("mumbai");
    expect(withoutCity("Colaba", "mumbai", "Mumbai")).toBe("colaba");
  });
});

describe("editDistance and skeleton", () => {
  it("counts a swap as one edit", () => {
    expect(editDistance("shahdra", "shahdara")).toBe(1);
    expect(editDistance("abcd", "abdc")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });
  it("gives sound-alike spellings one skeleton", () => {
    expect(skeleton("kapurthala")).toBe(skeleton("kapoorthala"));
    expect(skeleton("alipur")).toBe(skeleton("alipore"));
    expect(skeleton("kolaba")).toBe(skeleton("colaba"));
    expect(skeleton("besant nagar")).not.toBe(skeleton("anna nagar"));
  });
});

describe("scoreKey", () => {
  it("trusts exact, nearby spellings and whole-word containment", () => {
    expect(scoreKey("karol bagh", "karol bagh", 1)).toBe(1);
    expect(scoreKey("chandni chowk", "chandini chowk", 0.6)).toBeGreaterThanOrEqual(ACCEPT);
    expect(scoreKey("hazratganj", "hazratganj metro", 0.5)).toBeGreaterThanOrEqual(ACCEPT);
    expect(scoreKey("kapoorthala", "kapurthala", 0.3)).toBeGreaterThanOrEqual(ACCEPT);
  });
  it("does not let a shared suffix make a different place match", () => {
    expect(scoreKey("t nagar", "besant nagar", 0.4)).toBeLessThan(ACCEPT);
    expect(scoreKey("tilak nagar", "lajpat nagar", 0.4)).toBeLessThan(ACCEPT);
    expect(scoreKey("chandni chowk", "chowk", 0.4)).toBeLessThan(ACCEPT);
  });
  it("matches 4 letter names only exactly", () => {
    expect(scoreKey("sion", "sian", 0.2)).toBeLessThan(ACCEPT);
  });
});

describe("buildAreas", () => {
  it("makes one area per comma part, centred on every group that mentions it", () => {
    const areas = buildAreas([
      row("mumbai", "Dadar West", 1, 19.0, 72.8),
      row("mumbai", "Gokhale Road, Dadar West", 1, 19.02, 72.84),
    ]);
    expect(areas.map((a) => a.name)).toEqual(["Dadar West", "Gokhale Road"]);
    const dadar = areas[0];
    expect(dadar.lat).toBeCloseTo(19.01);
    expect(dadar.lng).toBeCloseTo(72.82);
    expect(dadar.weight).toBe(2);
    expect(dadar.slug).toBe("dadar-west");
  });

  it("drops notes, directions, generic words and areas nobody pinned", () => {
    const areas = buildAreas([
      row("lucknow", "Aminabad Market, Aminabad (lane adjacent Khun Khun Ji Jewellers)"),
      row("lucknow", "Near University Metro Station"),
      row("hyderabad", "Nagar"),
      row("mumbai", "Bandra Reclamation (West)"),
      { city: "delhi", locality: "Jamuna Paar, East Delhi", n: 1, pinned: 0, lat: null, lng: null },
      row("mumbai", "East"),
    ]);
    expect(areas.map((a) => `${a.city}/${a.name}`)).toEqual([
      "lucknow/Aminabad",
      "lucknow/Aminabad Market",
      "mumbai/Bandra Reclamation West",
    ]);
  });

  it("picks the most used spelling and is stable between runs", () => {
    const rows = [row("delhi", "GK 2", 1), row("delhi", "GK-2", 3)];
    expect(buildAreas(rows)[0].name).toBe("GK-2");
    expect(buildAreas([...rows].reverse())).toEqual(buildAreas(rows));
  });
});

describe("suggestionsFrom", () => {
  const hit = (name: string, score: number, lat: number, source: AreaHit["source"] = "places") => ({
    id: 1,
    name,
    lat,
    lng: 77,
    score,
    source,
  });
  it("skips weak, upstream-cached and stacked names and stops at the limit", () => {
    const out = suggestionsFrom(
      [
        hit("A", 0.5, 28.1),
        hit("A again", 0.45, 28.1001),
        hit("Cached", 0.45, 28.2, "nominatim"),
        hit("Weak", 0.1, 28.3),
        hit("B", 0.4, 28.4),
        hit("C", 0.35, 28.5),
        hit("D", 0.34, 28.6),
      ],
      3,
    );
    expect(out.map((h) => h.name)).toEqual(["A", "B", "C"]);
  });
});

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("areas in the database", () => {
  const db = handle?.db as Db;
  const localities = [
    row("delhi", "Chandni Chowk", 2, 28.656, 77.23),
    row("delhi", "Karol Bagh", 3, 28.65, 77.19),
    row("delhi", "Tilak Nagar", 1, 28.64, 77.09),
  ];
  const aliases = [{ city: "delhi", area: "Karol Bagh", aliases: ["KB"] }];

  beforeAll(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await syncAreas(db, localities, aliases);
  });
  afterAll(() => handle?.close());

  it("syncs areas and aliases, and a rerun changes nothing", async () => {
    const again = await syncAreas(db, localities, aliases);
    expect(again).toEqual({ areas: 3, aliases: 0, unmatchedAliases: [] });
    const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int n from areas`);
    expect(n).toBe(3);
  });

  it("reports an alias that points at no area", async () => {
    const res = await syncAreas(db, [], [{ city: "delhi", area: "Nowhere", aliases: ["x"] }]);
    expect(res.unmatchedAliases).toEqual(["delhi/Nowhere"]);
  });

  it("finds by exact name, alias and close spelling, best first", async () => {
    expect((await matchAreas(db, 1, "kb"))[0]).toMatchObject({ name: "Karol Bagh", score: 1 });
    const typo = await matchAreas(db, 1, "chandini chowk");
    expect(typo[0].name).toBe("Chandni Chowk");
    expect(typo[0].score).toBeGreaterThanOrEqual(ACCEPT);
    expect(await matchAreas(db, 1, "zzzzzz")).toEqual([]);
  });

  it("does not move a hand-placed area when places change", async () => {
    await db
      .update(schema.areas)
      .set({ source: "manual", lat: 1, lng: 2 })
      .where(sql`key = 'tilak nagar'`);
    await syncAreas(db, localities, aliases);
    const [tilak] = await db
      .select()
      .from(schema.areas)
      .where(sql`key = 'tilak nagar'`);
    expect([tilak.lat, tilak.lng]).toEqual([1, 2]);
  });

  it("answers the trigram lookup through the index", async () => {
    const plan = await db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      return tx.execute(sql`explain select id from areas where key % 'chandini chowk'`);
    });
    expect(plan.map((r) => String(r["QUERY PLAN"])).join("\n")).toContain("areas_key_trgm_idx");
  });

  it("remembers an upstream hit: near a known area it becomes an alias, elsewhere a new area", async () => {
    await rememberUpstream(db, 1, "chandni chauk", {
      lat: 28.6562,
      lng: 77.2301,
      displayName: "x",
    });
    expect((await matchAreas(db, 1, "chandni chauk"))[0]).toMatchObject({
      name: "Chandni Chowk",
      score: 1,
    });
    await rememberUpstream(db, 1, "hauz khas village", {
      lat: 28.55,
      lng: 77.19,
      displayName: "Hauz Khas Village, South Delhi, Delhi",
    });
    const [hit] = await matchAreas(db, 1, "hauz khas village");
    expect(hit).toMatchObject({ name: "Hauz Khas Village", source: "nominatim", score: 1 });
    // A cached upstream name is never offered as a "did you mean" choice.
    expect(suggestionsFrom(await matchAreas(db, 1, "hauz khas villag"))).toEqual([]);
  });
});
