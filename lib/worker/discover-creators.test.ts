import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { testDb, truncateAll } from "../../db/test-db";
import {
  approveCandidate,
  discoverCreators,
  mentionedPlaces,
  rejectCandidate,
  scoreCandidate,
} from "./discover-creators";

const upload = (title: string, description = "", day = "2026-11-01") => ({
  videoId: "v",
  publishedAt: new Date(`${day}T00:00:00Z`),
  title,
  description,
});

describe("mentionedPlaces", () => {
  const names = new Map([
    ["natraj dahi bhalle", "Natraj Dahi Bhalle"],
    ["natraj", "Natraj Dahi Bhalle"],
    ["gk", "GK Dhaba"],
  ]);
  it("matches whole names and aliases once per place", () => {
    expect(
      mentionedPlaces([upload("NATRAJ Dahi-Bhalle, Chandni Chowk"), upload("natraj again")], names),
    ).toEqual(["Natraj Dahi Bhalle"]);
  });
  it("ignores short keys and partial words", () => {
    expect(mentionedPlaces([upload("GK dhaba thali"), upload("natrajan biryani")], names)).toEqual(
      [],
    );
  });
});

describe("scoreCandidate", () => {
  const now = new Date("2026-11-21T00:00:00Z");
  it("ranks mentions above recency and subscribers", () => {
    expect(scoreCandidate(1, null, null, now)).toBeGreaterThan(
      scoreCandidate(0, now, 10_000_000, now),
    );
  });
  it("adds recency and log subscribers", () => {
    expect(scoreCandidate(2, now, 99_999, now)).toBe(25.5);
    expect(scoreCandidate(0, new Date("2024-01-01"), 0, now)).toBe(0);
  });
});

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("discoverCreators", () => {
  const db = handle?.db as Db;
  beforeEach(async () => {
    await truncateAll(db);
    const [city] = await db
      .insert(schema.cities)
      .values({ slug: "delhi", name: "Delhi" })
      .returning();
    const [known] = await db
      .insert(schema.creators)
      .values({ slug: "known", name: "Known", ytChannelId: "UCknown" })
      .returning();
    const [source] = await db
      .insert(schema.sources)
      .values({ platform: "youtube", externalId: "vid00000001", creatorId: known.id })
      .returning();
    const [place] = await db
      .insert(schema.places)
      .values({ slug: "natraj", name: "Natraj Dahi Bhalle", cityId: city.id })
      .returning();
    await db
      .insert(schema.recommendations)
      .values({ sourceId: source.id, placeId: place.id, status: "approved" });
    await db
      .insert(schema.creators)
      .values({ slug: "gone", name: "Gone", ytChannelId: "UCout", optedOut: true });
  });
  afterAll(() => handle?.close());

  const deps = () => ({
    db,
    search: async () => [
      { channelId: "UCknown", channel: "Known" },
      { channelId: "UCout", channel: "Gone" },
      { channelId: "UCnew", channel: "New Eats" },
    ],
    listUploads: async () => [upload("Natraj Dahi Bhalle review")],
    subscribers: async () => 999,
    now: () => new Date("2026-11-21T00:00:00Z"),
  });

  it("skips creators, including opted-out ones, and stores scored candidates", async () => {
    const { candidates } = await discoverCreators(deps(), { dryRun: false });
    expect(candidates.map((c) => c.ytChannelId)).toEqual(["UCnew"]);
    expect(candidates[0].evidence.mentions).toEqual(["Natraj Dahi Bhalle"]);
    const rows = await db.select().from(schema.creatorCandidates);
    expect(rows).toHaveLength(1);
  });

  it("dry run writes nothing", async () => {
    await discoverCreators(deps(), { dryRun: true });
    expect(await db.select().from(schema.creatorCandidates)).toHaveLength(0);
  });

  it("approve adds a creator; rejected channels are not suggested again", async () => {
    await discoverCreators(deps(), { dryRun: false });
    const [row] = await db.select().from(schema.creatorCandidates);
    await approveCandidate(db, row.id);
    const [creator] = await db
      .select()
      .from(schema.creators)
      .where(eq(schema.creators.ytChannelId, "UCnew"));
    expect(creator.slug).toBe("new-eats");

    await db.delete(schema.creators).where(eq(schema.creators.ytChannelId, "UCnew"));
    await rejectCandidate(db, row.id); // already approved: no-op
    const { candidates } = await discoverCreators(deps(), { dryRun: true });
    expect(candidates).toEqual([]);
  });
});
