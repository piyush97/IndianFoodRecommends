import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import type { ExtractedPick } from "./llm/extract";
import type { Upload } from "./youtube";
import { autoReviewPending, checkPick, decidePick, type PickCheck } from "./auto-review";

const pick: ExtractedPick = {
  place_name: "Chache Di Hatti",
  locality: "Kamla Nagar",
  city: "Delhi",
  dishes: ["Chole Bhature"],
  timestamp_seconds: null,
  confidence: 0.8,
};
const good: PickCheck = {
  grounded: 0.9,
  dishGrounded: 0.9,
  isVenue: 0.9,
  recommends: 0.85,
  city: "delhi",
  cityConfidence: 0.9,
};

describe("decidePick", () => {
  it.each(["Street Food", "breakfast", "Non-Veg", "fish"])("rejects generic dish %s", (dish) => {
    expect(decidePick({ ...pick, dishes: [dish] }, good)).toEqual({
      approve: false,
      reason: "generic-dish",
    });
  });

  it("approves a grounded, positive Delhi pick", () => {
    expect(decidePick(pick, good)).toEqual({ approve: true, city: "delhi" });
  });

  it("approves picks in every registered city", () => {
    expect(decidePick({ ...pick, city: "Bombay" }, good)).toEqual({
      approve: true,
      city: "mumbai",
    });
    expect(decidePick({ ...pick, city: "Kolkata" }, good)).toEqual({
      approve: true,
      city: "kolkata",
    });
  });

  it("rejects a city we do not cover", () => {
    expect(decidePick({ ...pick, city: "Pune" }, good)).toEqual({
      approve: false,
      reason: "not-supported-city",
    });
  });

  it("accepts New Delhi and NCR spellings", () => {
    expect(decidePick({ ...pick, city: "New Delhi" }, good).approve).toBe(true);
    expect(decidePick({ ...pick, city: "Gurgaon" }, good).approve).toBe(true);
  });

  it("uses Jev's city only when the LLM gave none and Jev is sure", () => {
    expect(decidePick({ ...pick, city: null }, { ...good, cityConfidence: 0.4 })).toEqual({
      approve: false,
      reason: "city-unknown",
    });
    expect(
      decidePick({ ...pick, city: null }, { ...good, city: "other", cityConfidence: 0.95 }),
    ).toEqual({
      approve: false,
      reason: "city-unknown",
    });
    expect(
      decidePick({ ...pick, city: null }, { ...good, city: "mumbai", cityConfidence: 0.85 }),
    ).toEqual({
      approve: true,
      city: "mumbai",
    });
  });

  it("rejects a place the video text never names", () => {
    expect(decidePick(pick, { ...good, grounded: 0.3 })).toEqual({
      approve: false,
      reason: "not-grounded",
    });
  });

  it("rejects a dish name the LLM mistook for a place", () => {
    expect(
      decidePick({ ...pick, place_name: "Kale ke Chole Kulche" }, { ...good, isVenue: 0.2 }),
    ).toEqual({
      approve: false,
      reason: "not-a-venue",
    });
  });

  it("rejects a place the video does not recommend", () => {
    expect(decidePick(pick, { ...good, recommends: 0.2 })).toEqual({
      approve: false,
      reason: "not-recommended",
    });
  });

  it("rejects a low-confidence LLM extraction", () => {
    expect(decidePick({ ...pick, confidence: 0.3 }, good)).toEqual({
      approve: false,
      reason: "low-confidence",
    });
  });

  describe("community suggestions (visitor-supplied text)", () => {
    const submitted = { ...pick, submitted: true } as ExtractedPick & { submitted: true };

    it("does not trust the visitor's city: Jev must agree with it", () => {
      expect(
        decidePick(
          { ...submitted, city: "Delhi" },
          { ...good, city: "mumbai", cityConfidence: 0.95 },
        ),
      ).toEqual({
        approve: false,
        reason: "city-mismatch",
      });
      expect(decidePick({ ...submitted, city: "Delhi" }, { ...good, cityConfidence: 0.5 })).toEqual(
        {
          approve: false,
          reason: "city-mismatch",
        },
      );
      expect(decidePick({ ...submitted, city: "Delhi" }, good)).toEqual({
        approve: true,
        city: "delhi",
      });
    });

    it("requires the video to mention the submitted dish", () => {
      expect(decidePick(submitted, { ...good, dishGrounded: 0.2 })).toEqual({
        approve: false,
        reason: "dish-not-grounded",
      });
    });
  });
});

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("autoReviewPending rejection reasons", () => {
  const db = handle?.db as Db;

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values({ slug: "a", name: "A", ytChannelId: "UC1" });
    await db.insert(schema.sources).values({ platform: "youtube", externalId: "v1", creatorId: 1 });
  });

  afterAll(async () => {
    await handle?.close();
  });

  const video: Upload = { videoId: "v1", publishedAt: new Date(), title: "D", description: "H" };
  const deps = {
    listUploads: async (): Promise<Upload[]> => [],
    listArchive: async (): Promise<Upload[]> => [],
    check: async () => good,
    geocode: async () => null,
  };

  async function rejectedFor(extracted: object, over: Partial<typeof deps> = {}) {
    await db.insert(schema.recommendations).values({ sourceId: 1, confidence: 0.9, extracted });
    await autoReviewPending({ ...deps, db, ...over });
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.status).toBe("rejected");
    return (rec.extracted as { autoReview: { reason: string; check: unknown } }).autoReview;
  }

  it("rejects a pick with no video text, even in the archive, as no-video-text", async () => {
    let checked = false;
    const review = await rejectedFor(pick, {
      check: async () => {
        checked = true;
        return good;
      },
    });
    expect(review).toMatchObject({ reason: "no-video-text", check: null });
    expect(checked).toBe(false);
  });

  it("keeps not-grounded for a pick the verifier rejected", async () => {
    const review = await rejectedFor(pick, {
      listUploads: async () => [video],
      check: async () => ({ ...good, grounded: 0.1 }),
    });
    expect(review).toMatchObject({ reason: "not-grounded", check: { grounded: 0.1 } });
  });

  it.each([{ place_name: "" }, { dishes: [] }])(
    "rejects an incomplete pick %o as no-place-name, unchecked",
    async (over) => {
      const review = await rejectedFor({ ...pick, ...over }, { listUploads: async () => [video] });
      expect(review).toMatchObject({ reason: "no-place-name", check: null });
    },
  );
});

describe("checkPick", () => {
  const video = { title: "t", description: "d" };
  const payload = (over: object = {}) =>
    new Response(
      JSON.stringify({
        answers: {
          grounded: { noul: 0.9 },
          dish_grounded: { noul: 0.8 },
          is_venue: { noul: 0.7 },
          recommends: { noul: 0.6 },
          city: { choice: "delhi", confidence: 0.95 },
          ...over,
        },
      }),
    );
  const fetchFor = (over: object) => (async () => payload(over)) as typeof fetch;

  it("maps well-formed answers", async () => {
    await expect(checkPick(video, pick, { apiKey: "k", fetchImpl: fetchFor({}) })).resolves.toEqual(
      {
        grounded: 0.9,
        dishGrounded: 0.8,
        isVenue: 0.7,
        recommends: 0.6,
        city: "delhi",
        cityConfidence: 0.95,
      },
    );
  });

  it("passes an abort signal to the Jev request", async () => {
    let signal: AbortSignal | null | undefined;
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal;
      return payload();
    }) as unknown as typeof fetch;
    await checkPick(video, pick, { apiKey: "k", fetchImpl });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  const malformed: Array<[string, object]> = [
    ["missing noul", { grounded: {} }],
    ["string score", { grounded: { noul: "0.9" } }],
    ["score above one", { recommends: { noul: 1.2 } }],
    ["missing city confidence", { city: { choice: "delhi" } }],
  ];

  it.each(malformed)("rejects malformed answers: %s", async (_name, over) => {
    await expect(
      checkPick(video, pick, { apiKey: "k", fetchImpl: fetchFor(over) }),
    ).rejects.toThrow();
  });
});
