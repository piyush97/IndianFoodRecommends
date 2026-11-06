import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { createSubmission, parseTimestamp } from "./submit";

describe("parseTimestamp", () => {
  it.each([
    ["4:12", 252],
    ["1:02:05", 3725],
    ["0:05", 5],
    ["", null],
    [undefined, null],
  ])("%s → %s", (input, out) => {
    expect(parseTimestamp(input)).toBe(out);
  });

  it.each(["4:72", "abc", "1:2:3:4", "-1:00"])("rejects %s", (input) => {
    expect(() => parseTimestamp(input)).toThrow();
  });
});

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("createSubmission", () => {
  const db = handle?.db as Db;
  const now = new Date("2026-11-07T12:00:00Z");
  const valid = {
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    creatorSlug: "one",
    city: "delhi",
    placeName: "Chache Di Hatti",
    dishName: "Chole Bhature",
    timestamp: "4:12",
  };

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values([
      { slug: "one", name: "One", ytChannelId: "UC1" },
      { slug: "gone", name: "Gone", optedOut: true },
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("stores a pending submission with no video text", async () => {
    expect(await createSubmission(db, valid, "ip1", now)).toEqual({ ok: true });
    const [row] = await db.select().from(schema.submissions);
    expect(row).toMatchObject({
      videoId: "dQw4w9WgXcQ",
      creatorId: 1,
      citySlug: "delhi",
      placeName: "Chache Di Hatti",
      dishName: "Chole Bhature",
      tsSeconds: 252,
      status: "pending",
      ipHash: "ip1",
    });
    expect(await db.select().from(schema.recommendations)).toHaveLength(0);
  });

  it("never creates a source row, so the creator's own ingest still sees the video", async () => {
    await createSubmission(db, valid, "ip1", now);
    expect(await db.select().from(schema.sources)).toHaveLength(0);
    expect(await db.select().from(schema.submissions)).toHaveLength(1);
  });

  it("rejects Instagram links: only YouTube feeds can be checked", async () => {
    expect(
      await createSubmission(
        db,
        { ...valid, url: "https://www.instagram.com/reel/C9xYz123AbC/" },
        "ip1",
        now,
      ),
    ).toEqual({ ok: false, status: 400 });
  });

  it("does not duplicate the same place for the same video", async () => {
    await createSubmission(db, valid, "ip1", now);
    expect(
      await createSubmission(db, { ...valid, placeName: " chache di hatti " }, "ip2", now),
    ).toEqual({
      ok: true,
    });
    expect(await db.select().from(schema.submissions)).toHaveLength(1);
  });

  it("allows 3 per hour per IP, then 429", async () => {
    for (const place of ["A1", "B2", "C3"]) {
      expect(await createSubmission(db, { ...valid, placeName: place }, "ip9", now)).toEqual({
        ok: true,
      });
    }
    expect(await createSubmission(db, { ...valid, placeName: "D4" }, "ip9", now)).toEqual({
      ok: false,
      status: 429,
    });
    expect(await db.select().from(schema.submissions)).toHaveLength(3);
  });

  it("rejects unknown or opted-out creators", async () => {
    expect(await createSubmission(db, { ...valid, creatorSlug: "nobody" }, "ip", now)).toEqual({
      ok: false,
      status: 404,
    });
    expect(await createSubmission(db, { ...valid, creatorSlug: "gone" }, "ip", now)).toEqual({
      ok: false,
      status: 404,
    });
  });

  it.each([
    { url: "https://example.com/v" },
    { city: "pune" },
    { placeName: "x" },
    { dishName: "" },
    { timestamp: "9:99" },
  ])("rejects bad input %o", async (bad) => {
    expect(await createSubmission(db, { ...valid, ...bad }, "ip", now)).toEqual({
      ok: false,
      status: 400,
    });
    expect(await db.select().from(schema.submissions)).toHaveLength(0);
  });
});
