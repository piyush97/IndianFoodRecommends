import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import type { Upload } from "../youtube";
import type { ExtractedPick } from "../llm/extract";
import { runIngest } from "./ingest";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

const TOKEN = "zzsecretdescriptiontoken";

function upload(videoId: string, title: string): Upload {
  return {
    videoId,
    publishedAt: new Date("2026-11-05T10:00:00Z"),
    title,
    description: `${TOKEN} ${title}`,
  };
}

const PICK: ExtractedPick = {
  place_name: "Chache Di Hatti",
  locality: "Kamla Nagar",
  city: "Delhi",
  dishes: ["Chole Bhature"],
  timestamp_seconds: 252,
  confidence: 0.9,
};

describeDb("runIngest", () => {
  const db = handle?.db as Db;
  let creatorId = 0;

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi", state: "Delhi" });
    await db.insert(schema.cities).values({ slug: "mumbai", name: "Mumbai" });
    const [creator] = await db
      .insert(schema.creators)
      .values({
        slug: "ayush-sapra",
        name: "Aayush Sapra",
        ytChannelId: "UC2UWtuZR3kH-5C26HVMMB6A",
      })
      .returning();
    creatorId = creator.id;
    const [place] = await db
      .insert(schema.places)
      .values({ slug: "chache-di-hatti", name: "Chache Di Hatti", cityId: 1 })
      .returning();
    await db.insert(schema.placeAliases).values({ placeId: place.id, alias: "चाचे दी हट्टी" });
    await db.insert(schema.dishes).values({ slug: "chole-bhature", name: "Chole Bhature" });
  });

  afterAll(async () => {
    await handle?.close();
  });

  const now = () => new Date("2026-11-06T03:00:00Z");

  function deps(overrides: Partial<Parameters<typeof runIngest>[0]> = {}) {
    return {
      db,
      now,
      listUploads: async () => [upload("vid1", "Delhi tour"), upload("vid2", "Old Delhi")],
      extract: async () => [PICK],
      ...overrides,
    };
  }

  it("ingests new videos as pending recommendations", async () => {
    const summary = await runIngest(deps());
    expect(summary).toEqual({ videos: 2, picks: 2, errors: 0 });
    const sources = await db.select().from(schema.sources);
    const recs = await db.select().from(schema.recommendations);
    expect(sources).toHaveLength(2);
    expect(recs).toHaveLength(2);
    expect(recs.every((r) => r.status === "pending" && r.origin === "llm")).toBe(true);
    expect(recs[0].placeId).toBeNull();
  });

  it("backfills a new creator's feed up to a year back", async () => {
    let since: Date | undefined;
    await runIngest(
      deps({
        listUploads: async (_id, opts) => {
          since = opts?.since;
          return [];
        },
      }),
    );
    expect(since?.toISOString().slice(0, 10)).toBe("2025-11-06");
  });

  it("does not duplicate on a second run", async () => {
    await runIngest(deps());
    const second = await runIngest(deps());
    expect(second).toEqual({ videos: 0, picks: 0, errors: 0 });
    expect(await db.select().from(schema.sources)).toHaveLength(2);
    expect(await db.select().from(schema.recommendations)).toHaveLength(2);
  });

  it("keeps going when one video fails extraction", async () => {
    let call = 0;
    const summary = await runIngest(
      deps({
        extract: async () => {
          call++;
          if (call === 1) throw new Error("bad json");
          return [PICK];
        },
      }),
    );
    expect(summary.errors).toBe(1);
    expect(summary.videos).toBe(1);
    expect(summary.picks).toBe(1);
    // The failed video left no source row, so the next run retries it.
    expect(await db.select().from(schema.sources)).toHaveLength(1);
    const retry = await runIngest(deps());
    expect(retry).toEqual({ videos: 1, picks: 1, errors: 0 });
  });

  it("retries an older video after a newer one advanced the cursor", async () => {
    const older = {
      ...upload("vidOld", "Old Delhi"),
      publishedAt: new Date("2026-11-01T10:00:00Z"),
    };
    const newer = {
      ...upload("vidNew", "New Delhi"),
      publishedAt: new Date("2026-11-05T10:00:00Z"),
    };
    const all = [older, newer];
    const listUploads: Parameters<typeof runIngest>[0]["listUploads"] = async (_id, opts) => {
      const since = opts?.since;
      return since ? all.filter((u) => u.publishedAt >= since) : all;
    };

    const first = await runIngest(
      deps({
        listUploads,
        extract: async ({ title }) => {
          if (title === "Old Delhi") throw new Error("bad json");
          return [PICK];
        },
      }),
    );
    expect(first.errors).toBe(1);
    expect((await db.select().from(schema.sources)).map((s) => s.externalId)).toEqual(["vidNew"]);

    const retry = await runIngest(deps({ listUploads }));
    expect(retry).toEqual({ videos: 1, picks: 1, errors: 0 });
    const stored = (await db.select().from(schema.sources)).map((s) => s.externalId);
    expect(stored.sort()).toEqual(["vidNew", "vidOld"]);
  });

  it("keeps going when one channel feed fails", async () => {
    await db
      .insert(schema.creators)
      .values({ slug: "other", name: "Other", ytChannelId: "UCbroken" });
    const summary = await runIngest(
      deps({
        listUploads: async (channelId) => {
          if (channelId === "UCbroken") throw new Error("feed down");
          return [upload("vid1", "Delhi tour")];
        },
      }),
    );
    expect(summary.errors).toBe(1);
    expect(summary.videos).toBe(1);
  });

  it("skips opted-out creators", async () => {
    await db
      .update(schema.creators)
      .set({ optedOut: true })
      .where(eq(schema.creators.id, creatorId));
    const summary = await runIngest(deps());
    expect(summary).toEqual({ videos: 0, picks: 0, errors: 0 });
  });

  it("suggests an existing place while leaving place_id null", async () => {
    await runIngest(deps());
    const [rec] = await db.select().from(schema.recommendations);
    const extracted = rec.extracted as { suggestions: { places: { id: number }[] } };
    expect(extracted.suggestions.places[0].id).toBe(1);
    expect(rec.placeId).toBeNull();
  });

  it("stores a non-local city as pending instead of dropping it", async () => {
    await runIngest(deps({ extract: async () => [{ ...PICK, city: "Mumbai" }] }));
    const [rec] = await db.select().from(schema.recommendations);
    expect((rec.extracted as { city: string }).city).toBe("Mumbai");
    expect(rec.status).toBe("pending");
  });

  it("returns a zeroed summary when another run holds the lock", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked!: () => void;
    const holding = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const slow = deps({
      listUploads: async () => {
        locked(); // the advisory lock is held by now
        await gate;
        return [upload("vid1", "Delhi tour")];
      },
    });
    const first = runIngest(slow);
    await holding;
    const second = await runIngest(deps());
    release();
    await first;
    expect(second).toEqual({ videos: 0, picks: 0, errors: 0 });
  });

  it("never persists video title or description text", async () => {
    await runIngest(deps());
    const recs = await db.select().from(schema.recommendations);
    const sources = await db.select().from(schema.sources);
    const everything = JSON.stringify({ recs, sources });
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain("Delhi tour");
  });
});
