import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { schema, type Db } from "../../../db";
import { testDb, truncateAll } from "../../../db/test-db";

vi.mock("../../../lib/auth", () => ({
  requireAdmin: async () => {
    throw new Error("AuthError: forbidden");
  },
}));

const { approveAction, rejectAction, mergeAction } = await import("./actions");

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("admin server actions", () => {
  const db = handle!.db as Db;

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.creators).values({ slug: "ayush", name: "Aayush Sapra" });
    await db
      .insert(schema.sources)
      .values({ platform: "youtube", externalId: "vid1", creatorId: 1 });
  });

  afterAll(async () => {
    await handle?.close();
  });

  it("refuses approve without an admin session", async () => {
    const [rec] = await db
      .insert(schema.recommendations)
      .values({ sourceId: 1 })
      .returning();
    await expect(
      approveAction({
        id: rec.id,
        place: { name: "Chache Di Hatti", cityId: 1, lat: 28.68, lng: 77.2 },
        dish: { name: "Chole Bhature" },
        tsSeconds: null,
        note: "",
      }),
    ).rejects.toThrow();
    const [after] = await db.select().from(schema.recommendations);
    expect(after.status).toBe("pending");
    expect(await db.select().from(schema.places)).toHaveLength(0);
  });

  it("refuses reject without an admin session", async () => {
    const [rec] = await db
      .insert(schema.recommendations)
      .values({ sourceId: 1 })
      .returning();
    await expect(rejectAction(rec.id)).rejects.toThrow();
    const [after] = await db.select().from(schema.recommendations);
    expect(after.status).toBe("pending");
  });

  it("refuses merge without an admin session", async () => {
    await expect(mergeAction(1, 2)).rejects.toThrow();
  });
});
