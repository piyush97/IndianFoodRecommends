import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import type { PickCheck } from "../auto-review";
import type { Upload } from "../youtube";
import { retryUnchecked } from "./retry-unchecked";

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

const pick = {
  place_name: "Chache Di Hatti",
  locality: "Kamla Nagar",
  city: "Delhi",
  dishes: ["Chole Bhature"],
  timestamp_seconds: null,
  confidence: 0.9,
};

describeDb("retryUnchecked", () => {
  const db = handle?.db as Db;

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values({ slug: "a", name: "A", ytChannelId: "UC1" });
    await db.insert(schema.sources).values([
      { platform: "youtube", externalId: "v1", creatorId: 1 },
      { platform: "youtube", externalId: "v2", creatorId: 1 },
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  async function rejected(
    reason: string,
    over: Partial<typeof schema.recommendations.$inferInsert> = {},
  ) {
    const [row] = await db
      .insert(schema.recommendations)
      .values({
        sourceId: 1,
        status: "rejected",
        confidence: 0.9,
        reviewedAt: new Date(),
        extracted: { ...pick, autoReview: { approve: false, reason, check: null } },
        ...over,
      })
      .returning();
    return row.id;
  }

  const status = async (id: number) =>
    (
      await db
        .select({ status: schema.recommendations.status })
        .from(schema.recommendations)
        .where(eq(schema.recommendations.id, id))
    )[0].status;

  // Feed window is empty: the video is only reachable through the archive.
  const deps = (check: PickCheck = good, archive = [upload("v1")]) => ({
    db,
    listUploads: async () => [],
    listArchive: async () => archive,
    check: async () => check,
    geocode: async () => null,
  });

  it("re-opens a no-video-text pick and lets the verifier approve it via the archive", async () => {
    const id = await rejected("no-video-text");
    expect(await retryUnchecked(deps())).toEqual({
      reopened: 1,
      approved: 1,
      rejected: 0,
      skipped: 0,
    });
    expect(await status(id)).toBe("approved");
    expect(await db.select().from(schema.places)).toHaveLength(1);
  });

  it("does not approve blindly: the verifier still decides", async () => {
    const id = await rejected("no-video-text");
    const summary = await retryUnchecked(deps({ ...good, grounded: 0.1 }));
    expect(summary).toMatchObject({ reopened: 1, approved: 0, rejected: 1 });
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.id).toBe(id);
    expect(rec.status).toBe("rejected");
    expect((rec.extracted as { autoReview: { reason: string } }).autoReview.reason).toBe(
      "not-grounded",
    );
  });

  it("sends a pick whose text is still missing back to no-video-text", async () => {
    const id = await rejected("no-video-text");
    const summary = await retryUnchecked(deps(good, []));
    expect(summary).toMatchObject({ reopened: 1, approved: 0, rejected: 1 });
    const [rec] = await db.select().from(schema.recommendations);
    expect(rec.id).toBe(id);
    expect(rec.status).toBe("rejected");
    expect((rec.extracted as { autoReview: { reason: string } }).autoReview.reason).toBe(
      "no-video-text",
    );
  });

  it("re-opens legacy unchecked picks stored as not-grounded with no check", async () => {
    const id = await rejected("not-grounded");
    expect(await retryUnchecked(deps())).toMatchObject({ reopened: 1, approved: 1 });
    expect(await status(id)).toBe("approved");
  });

  it("leaves verifier rejections, other reasons and community picks alone", async () => {
    const ids = [
      await rejected("not-grounded", {
        extracted: { ...pick, autoReview: { approve: false, reason: "not-grounded", check: good } },
      }),
      // Legacy incomplete pick: a re-check cannot add a place name.
      await rejected("not-grounded", {
        extracted: {
          ...pick,
          place_name: "",
          autoReview: { approve: false, reason: "not-grounded", check: null },
        },
      }),
      await rejected("no-place-name"),
      await rejected("duplicate"),
      await rejected("no-video-text", { origin: "community" }),
    ];
    expect(await retryUnchecked(deps())).toEqual({
      reopened: 0,
      approved: 0,
      rejected: 0,
      skipped: 0,
    });
    for (const id of ids) expect(await status(id)).toBe("rejected");
  });

  it("is idempotent: a second run re-opens only what is still unchecked", async () => {
    const found = await rejected("no-video-text");
    const missing = await rejected("no-video-text", { sourceId: 2 });
    expect(await retryUnchecked(deps())).toMatchObject({ reopened: 2, approved: 1, rejected: 1 });
    expect(await retryUnchecked(deps())).toMatchObject({ reopened: 1, approved: 0, rejected: 1 });
    expect(await status(found)).toBe("approved");
    expect(await status(missing)).toBe("rejected");
    expect(await db.select().from(schema.places)).toHaveLength(1);
  });
});
