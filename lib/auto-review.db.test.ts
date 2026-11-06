import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { autoReviewPending, type PickCheck } from "./auto-review";
import type { Upload } from "./youtube";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

const good: PickCheck = {
  grounded: 0.9,
  isVenue: 0.9,
  recommends: 0.9,
  city: "delhi",
  cityConfidence: 0.9,
};

function upload(videoId: string): Upload {
  return { videoId, publishedAt: new Date(), title: "Delhi tour", description: "Chache Di Hatti" };
}

describeDb("autoReviewPending", () => {
  const db = handle?.db as Db;

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values([
      { slug: "delhi", name: "Delhi" },
      { slug: "mumbai", name: "Mumbai" },
    ]);
    await db.insert(schema.creators).values({ slug: "a", name: "A", ytChannelId: "UC1" });
    await db.insert(schema.sources).values({ platform: "youtube", externalId: "v1", creatorId: 1 });
  });

  afterAll(async () => {
    await handle?.close();
  });

  async function pending(extracted: object) {
    const [row] = await db
      .insert(schema.recommendations)
      .values({ sourceId: 1, confidence: 0.9, extracted })
      .returning();
    return row.id;
  }

  const base = {
    place_name: "Chache Di Hatti",
    locality: "Kamla Nagar",
    city: "Delhi",
    dishes: ["Chole Bhature"],
    timestamp_seconds: null,
    confidence: 0.9,
    suggestions: { places: [], dishes: [] },
  };

  const deps = (check: PickCheck = good) => ({
    db,
    listUploads: async () => [upload("v1")],
    check: async () => check,
    geocode: async () => ({ lat: 28.68, lng: 77.2, osmId: "1" }),
  });

  it("approves a good pick and creates the geocoded place and dish", async () => {
    await pending(base);
    expect(await autoReviewPending(deps())).toEqual({ approved: 1, rejected: 0, skipped: 0 });
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("approved");
    const [place] = await db.select().from(schema.places);
    expect(place).toMatchObject({ name: "Chache Di Hatti", lat: 28.68, cityId: 1 });
  });

  it("falls back to the locality centre when the shop itself is not on the map", async () => {
    await pending(base);
    const queries: string[] = [];
    await autoReviewPending({
      ...deps(),
      geocode: async (q) => {
        queries.push(q);
        return q.startsWith("Chache") ? null : { lat: 28.69, lng: 77.21, osmId: "loc" };
      },
    });
    expect(queries).toEqual(["Chache Di Hatti, Kamla Nagar, Delhi", "Kamla Nagar, Delhi"]);
    const [place] = await db.select().from(schema.places);
    expect(place).toMatchObject({ lat: 28.69, osmId: "approx:loc" });
  });

  it("files a Mumbai pick under Mumbai and geocodes it there", async () => {
    await pending({ ...base, city: "Mumbai", place_name: "Bademiya", locality: "Colaba" });
    const queries: string[] = [];
    await autoReviewPending({
      ...deps(),
      geocode: async (q) => {
        queries.push(q);
        return { lat: 18.92, lng: 72.83, osmId: "m" };
      },
    });
    const [place] = await db.select().from(schema.places);
    expect(place).toMatchObject({ name: "Bademiya", cityId: 2 });
    expect(queries[0]).toBe("Bademiya, Colaba, Mumbai");
  });

  it("rejects a Pune pick and records why", async () => {
    await pending({ ...base, city: "Pune" });
    await autoReviewPending(deps());
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("rejected");
    expect((rec.extracted as { autoReview: { reason: string } }).autoReview.reason).toBe(
      "not-supported-city",
    );
    expect(await db.select().from(schema.places)).toHaveLength(0);
  });

  it("reuses a strongly matched existing place", async () => {
    const [existing] = await db
      .insert(schema.places)
      .values({ slug: "chache-di-hatti", name: "Chache Di Hatti", cityId: 1 })
      .returning();
    await pending({
      ...base,
      place_name: "Chachey di Hatti",
      suggestions: { places: [{ id: existing.id, name: existing.name, score: 0.85, via: "name" }] },
    });
    await autoReviewPending(deps());
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.placeId).toBe(existing.id);
    expect(await db.select().from(schema.places)).toHaveLength(1);
    const aliases = await db.select().from(schema.placeAliases);
    expect(aliases.map((a) => a.alias)).toContain("Chachey di Hatti");
  });

  it("rejects the second of two identical picks from one video", async () => {
    await pending(base);
    await pending(base);
    const summary = await autoReviewPending(deps());
    expect(summary).toEqual({ approved: 1, rejected: 1, skipped: 0 });
  });

  it("leaves a pick pending when Jev is down", async () => {
    await pending(base);
    const summary = await autoReviewPending({
      ...deps(),
      check: async () => {
        throw new Error("down");
      },
    });
    expect(summary.skipped).toBe(1);
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("pending");
  });

  it("rejects a pick whose video is no longer in the feed", async () => {
    await pending(base);
    await autoReviewPending({ ...deps(), listUploads: async () => [] });
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("rejected");
  });
});
