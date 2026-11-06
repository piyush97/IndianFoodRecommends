import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import {
  addManualRecommendation,
  approveRecommendation,
  mergePlaces,
  rejectRecommendation,
  suggestLocation,
} from "./review";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("review operations", () => {
  const db = handle?.db as Db;

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi", state: "Delhi" });
    await db
      .insert(schema.creators)
      .values({ slug: "ayush", name: "Aayush Sapra", ytChannelId: "UC1" });
    await db
      .insert(schema.sources)
      .values({ platform: "youtube", externalId: "vid1", creatorId: 1 });
  });

  afterAll(async () => {
    await handle?.close();
  });

  async function pendingRec(): Promise<number> {
    const [rec] = await db
      .insert(schema.recommendations)
      .values({ sourceId: 1, confidence: 0.9 })
      .returning();
    return rec.id;
  }

  const validInput = {
    place: {
      name: "Chache Di Hatti",
      locality: "Kamla Nagar",
      cityId: 1,
      lat: 28.68,
      lng: 77.2,
    },
    dish: { name: "Chole Bhature" },
    tsSeconds: 252,
    note: "Order the chole bhature",
  };

  it("approves with a new place and dish", async () => {
    const id = await pendingRec();
    await approveRecommendation(db, { id, ...validInput }, "editor@example.com");
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("approved");
    expect(rec.reviewedAt).not.toBeNull();
    expect(rec.placeId).not.toBeNull();
    expect(await db.select().from(schema.places)).toHaveLength(1);
    expect(await db.select().from(schema.dishes)).toHaveLength(1);
  });

  it("links an existing place without creating one", async () => {
    const [place] = await db
      .insert(schema.places)
      .values({ slug: "chache-di-hatti", name: "Chache Di Hatti", cityId: 1 })
      .returning();
    const id = await pendingRec();
    await approveRecommendation(
      db,
      { id, ...validInput, place: { existingId: place.id } },
      "editor@example.com",
    );
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.placeId).toBe(place.id);
    expect(await db.select().from(schema.places)).toHaveLength(1);
  });

  it("rejects coordinates outside India and leaves the pick pending", async () => {
    const id = await pendingRec();
    await expect(
      approveRecommendation(
        db,
        { id, ...validInput, place: { ...validInput.place, lat: 51.5 } },
        "editor@example.com",
      ),
    ).rejects.toThrow();
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("pending");
    expect(await db.select().from(schema.places)).toHaveLength(0);
  });

  it("rejects a note longer than 140 characters", async () => {
    const id = await pendingRec();
    await expect(
      approveRecommendation(db, { id, ...validInput, note: "x".repeat(141) }, "e@example.com"),
    ).rejects.toThrow();
    expect(await db.select().from(schema.places)).toHaveLength(0);
  });

  it("refuses to approve the same pick twice", async () => {
    const id = await pendingRec();
    await approveRecommendation(db, { id, ...validInput }, "editor@example.com");
    await expect(
      approveRecommendation(db, { id, ...validInput }, "editor@example.com"),
    ).rejects.toThrow(/pending/);
  });

  it("suffixes slugs that collide", async () => {
    await approveRecommendation(
      db,
      { id: await pendingRec(), ...validInput },
      "editor@example.com",
    );
    await approveRecommendation(
      db,
      {
        id: await pendingRec(),
        ...validInput,
        place: { ...validInput.place, name: "Chache Di Hatti!" },
      },
      "editor@example.com",
    );
    const slugs = (await db.select().from(schema.places)).map((p) => p.slug).sort();
    expect(slugs).toEqual(["chache-di-hatti", "chache-di-hatti-2"]);
  });

  it("rejects a pick", async () => {
    const id = await pendingRec();
    await rejectRecommendation(db, id);
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("rejected");
  });

  it("merges one place into another and deletes the source", async () => {
    const [from] = await db
      .insert(schema.places)
      .values({ slug: "chachey-di-hatti", name: "Chachey Di Hatti", cityId: 1 })
      .returning();
    const [into] = await db
      .insert(schema.places)
      .values({ slug: "chache-di-hatti", name: "Chache Di Hatti", cityId: 1 })
      .returning();
    const id = await pendingRec();
    await db
      .update(schema.recommendations)
      .set({ placeId: from.id })
      .where(eq(schema.recommendations.id, id));

    await mergePlaces(db, from.id, into.id);

    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.placeId).toBe(into.id);
    expect((await db.select().from(schema.places)).map((p) => p.id)).toEqual([into.id]);
    const aliases = await db.select().from(schema.placeAliases);
    expect(aliases.map((a) => a.alias)).toContain("Chachey Di Hatti");
  });

  it("adds a manual Instagram pick as approved with its own source", async () => {
    const id = await addManualRecommendation(db, {
      url: "https://www.instagram.com/reel/C9xYz123AbC/",
      creatorId: 1,
      place: validInput.place,
      dish: validInput.dish,
      tsSeconds: null,
      note: "Seen on reel",
    });
    const [rec] = await db
      .select()
      .from(schema.recommendations)
      .where(eq(schema.recommendations.id, id));
    expect(rec).toMatchObject({ status: "approved", origin: "manual" });
    const [source] = await db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.externalId, "C9xYz123AbC"));
    expect(source.platform).toBe("instagram");
  });

  it("rejects a manual pick with an unsupported URL and writes nothing", async () => {
    await expect(
      addManualRecommendation(db, {
        url: "https://example.com/x",
        creatorId: 1,
        place: validInput.place,
        dish: validInput.dish,
        tsSeconds: null,
        note: "",
      }),
    ).rejects.toThrow(/URL/);
    expect(await db.select().from(schema.places)).toHaveLength(0);
  });

  it("refuses to merge a place into itself", async () => {
    const [place] = await db
      .insert(schema.places)
      .values({ slug: "x", name: "X", cityId: 1 })
      .returning();
    await expect(mergePlaces(db, place.id, place.id)).rejects.toThrow();
  });

  it("refuses to reject an already approved pick", async () => {
    const id = await pendingRec();
    await approveRecommendation(db, { id, ...validInput }, "[EMAIL]");
    await expect(rejectRecommendation(db, id)).rejects.toThrow(/pending/);
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("approved");
  });

  it("keeps reports and survives duplicate picks when merging", async () => {
    const [from] = await db
      .insert(schema.places)
      .values({ slug: "a", name: "A", cityId: 1 })
      .returning();
    const [into] = await db
      .insert(schema.places)
      .values({ slug: "b", name: "B", cityId: 1 })
      .returning();
    // Same source, no dish, no timestamp on both places: a dedupe collision.
    await db.insert(schema.recommendations).values([
      { sourceId: 1, placeId: from.id },
      { sourceId: 1, placeId: into.id },
    ]);
    await db.insert(schema.reports).values({ placeId: from.id, kind: "closed" });

    await mergePlaces(db, from.id, into.id);

    const recs = await db.select().from(schema.recommendations);
    expect(recs.map((r) => r.placeId)).toEqual([into.id]);
    const reports = await db.select().from(schema.reports);
    expect(reports.map((r) => r.placeId)).toEqual([into.id]);
  });
});

describe("suggestLocation", () => {
  it("returns null on an empty result", async () => {
    const result = await suggestLocation("nowhere", {
      fetchImpl: async () => new Response("[]"),
      sleep: async () => {},
    });
    expect(result).toBeNull();
  });

  it("restricts the query to India and sends a user agent", async () => {
    let seen: { url: string; ua: string | null } | null = null;
    const result = await suggestLocation("Chache Di Hatti", {
      ua: "ifr/0.1 (me@example.com)",
      sleep: async () => {},
      fetchImpl: async (input, init) => {
        seen = { url: String(input), ua: new Headers(init?.headers).get("user-agent") };
        return new Response(
          JSON.stringify([{ lat: "28.68", lon: "77.2", osm_id: "123", display_name: "Delhi" }]),
        );
      },
    });
    expect(seen!.url).toContain("countrycodes=in");
    expect(seen!.ua).toBe("ifr/0.1 (me@example.com)");
    expect(result).toEqual({ lat: 28.68, lng: 77.2, osmId: "123", displayName: "Delhi" });
  });

  it("answers a repeated query from cache without a second request", async () => {
    let calls = 0;
    const deps = {
      ua: "ifr/0.1 (me@example.com)",
      sleep: async () => {},
      fetchImpl: async () => {
        calls++;
        return new Response(
          JSON.stringify([{ lat: "28.6", lon: "77.2", osm_id: "9", display_name: "D" }]),
        );
      },
    };
    await suggestLocation("Cache Me, Delhi", deps);
    const second = await suggestLocation("  cache me,  delhi ", deps);
    expect(calls).toBe(1);
    expect(second?.osmId).toBe("9");
  });

  it("waits at least a second between calls", async () => {
    let waited = 0;
    const deps = {
      ua: "ifr/0.1 (me@example.com)",
      sleep: async (ms: number) => {
        waited += ms;
      },
      fetchImpl: async () => new Response("[]"),
    };
    await suggestLocation("a", deps);
    await suggestLocation("b", deps);
    expect(waited).toBeGreaterThanOrEqual(1000);
  });
});
