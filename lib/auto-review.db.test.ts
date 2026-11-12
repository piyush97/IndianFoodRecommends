import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { autoReviewPending, type PickCheck } from "./auto-review";
import type { Upload } from "./youtube";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

const good: PickCheck = {
  grounded: 0.9,
  dishGrounded: 0.9,
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

  it("recovers a video beyond the archive window by its ID", async () => {
    await pending(base);
    const summary = await autoReviewPending({
      ...deps(),
      listUploads: async () => [],
      listArchive: async () => [],
      getUpload: async (channel, id) => {
        expect(channel).toBe("UC1");
        expect(id).toBe("v1");
        return upload(id);
      },
    });
    expect(summary.approved).toBe(1);
  });

  it("approves a good pick and creates the geocoded place and dish", async () => {
    await pending(base);
    expect(await autoReviewPending(deps())).toEqual({ approved: 1, rejected: 0, skipped: 0 });
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("approved");
    const [place] = await db.select().from(schema.places);
    expect(place).toMatchObject({ name: "Chache Di Hatti", lat: 28.68, cityId: 1 });
  });

  it("files a qualified dish name under the plain dish instead of creating a variant", async () => {
    await db.insert(schema.dishes).values({ slug: "chole-bhature", name: "Chole Bhature" });
    await pending({ ...base, dishes: ["Desi Ghee Chole Bhature"] });
    expect(await autoReviewPending(deps())).toEqual({ approved: 1, rejected: 0, skipped: 0 });
    expect((await db.select().from(schema.dishes)).map((d) => d.name)).toEqual(["Chole Bhature"]);
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.dishId).toBe(1);
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

  it("files two creators' picks of one shop under one place, though named differently", async () => {
    await db.insert(schema.creators).values({ slug: "b", name: "B", ytChannelId: "UC2" });
    await db.insert(schema.sources).values({ platform: "youtube", externalId: "v2", creatorId: 2 });
    await pending({ ...base, place_name: "Arsalan", locality: null });
    await db.insert(schema.recommendations).values({
      sourceId: 2,
      confidence: 0.9,
      extracted: { ...base, place_name: "Arsalan Biryani", locality: null },
    });
    const summary = await autoReviewPending({
      ...deps(),
      listUploads: async (channel: string) => [upload(channel === "UC1" ? "v1" : "v2")],
    });
    expect(summary).toEqual({ approved: 2, rejected: 0, skipped: 0 });
    const places = await db.select().from(schema.places);
    expect(places.map((p) => p.name)).toEqual(["Arsalan"]);
    const recs = await db.select().from(schema.recommendations);
    expect(recs.map((r) => r.placeId)).toEqual([places[0].id, places[0].id]);
    const aliases = await db.select().from(schema.placeAliases);
    expect(aliases.map((a) => a.alias)).toEqual(["Arsalan Biryani"]);
  });

  it("keeps a branch named after its locality apart from the main shop", async () => {
    await db
      .insert(schema.places)
      .values({ slug: "karims", name: "Karim's", cityId: 1, locality: "Ganganagar" });
    await pending({ ...base, place_name: "Karim's Madhyamgram", locality: "Madhyamgram" });
    await autoReviewPending(deps());
    expect((await db.select().from(schema.places)).map((p) => p.name).sort()).toEqual([
      "Karim's",
      "Karim's Madhyamgram",
    ]);
  });

  it("rejects the second of two identical picks from one video", async () => {
    await pending(base);
    await pending(base);
    const summary = await autoReviewPending(deps());
    expect(summary).toEqual({ approved: 1, rejected: 1, skipped: 0 });
  });

  async function submission(over: Partial<typeof schema.submissions.$inferInsert> = {}) {
    const [row] = await db
      .insert(schema.submissions)
      .values({
        videoId: "v1",
        creatorId: 1,
        citySlug: "delhi",
        placeName: "Chache Di Hatti",
        dishName: "Chole Bhature",
        tsSeconds: 252,
        ipHash: "h",
        ...over,
      })
      .returning();
    return row.id;
  }

  it("publishes a submission only from the creator's own feed, creating the source then", async () => {
    await db.delete(schema.sources);
    await submission();
    const summary = await autoReviewPending(deps());
    expect(summary.approved).toBe(1);
    const [sub] = await db.select().from(schema.submissions);
    expect(sub).toMatchObject({ status: "approved" });
    const [source] = await db.select().from(schema.sources);
    expect(source).toMatchObject({ externalId: "v1", creatorId: 1 });
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec).toMatchObject({ origin: "community", status: "approved", tsSeconds: 252 });
  });

  it("rejects a submission whose video is not in that creator's feed", async () => {
    await submission({ videoId: "someone-elses" });
    await autoReviewPending(deps());
    const [sub] = await db.select().from(schema.submissions);
    expect(sub).toMatchObject({ status: "rejected", reason: "not-creators-video" });
    expect(await db.select().from(schema.recommendations)).toHaveLength(0);
  });

  it("rejects a submission whose city Jev does not confirm", async () => {
    await submission();
    await autoReviewPending({ ...deps(), check: async () => ({ ...good, city: "mumbai" }) });
    const [sub] = await db.select().from(schema.submissions);
    expect(sub).toMatchObject({ status: "rejected", reason: "city-mismatch" });
  });

  it("adds a submitted pick to a video the worker already ingested", async () => {
    await submission();
    await autoReviewPending(deps());
    expect(await db.select().from(schema.sources)).toHaveLength(1);
    expect((await db.select().from(schema.recommendations))[0].sourceId).toBe(1);
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

  it("reviews a pick whose video is older than the feed window via the archive", async () => {
    await pending(base);
    const summary = await autoReviewPending({
      ...deps(),
      listUploads: async () => [],
      listArchive: async () => [upload("v1")],
    });
    expect(summary.approved).toBe(1);
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("approved");
  });
});
