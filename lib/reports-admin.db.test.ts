import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { schema, type Db } from "../db";
import { testDb, truncateAll } from "../db/test-db";
import { openReports, resolvePlace } from "./reports-admin";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;
const now = new Date("2026-11-10T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const earlier = new Date("2026-10-01T08:00:00Z");

describeDb("reports admin", () => {
  const db = handle?.db as Db;

  async function report(
    placeId: number,
    extra: { kind?: string; ipHash?: string | null; createdAt?: Date; resolvedAt?: Date } = {},
  ) {
    await db.insert(schema.reports).values({ placeId, kind: "closed", message: "m", ...extra });
  }
  const place = async (id: number) =>
    (await db.select().from(schema.places).where(eq(schema.places.id, id)))[0];

  beforeEach(async () => {
    await truncateAll(db);
    await db.insert(schema.cities).values({ slug: "delhi", name: "Delhi" });
    await db.insert(schema.places).values([
      { slug: "a", name: "A", cityId: 1, lastVerified: "2025-01-01" },
      { slug: "b", name: "B", cityId: 1, lastVerified: "2025-01-01" },
    ]);
  });

  afterAll(async () => {
    await handle?.close();
  });

  describe("resolvePlace", () => {
    it("closed sets status, status_changed_at, last_verified, resolves all", async () => {
      await report(1);
      await report(1, { kind: "wrong-info" });
      await resolvePlace(db, 1, "closed", now);
      const p = await place(1);
      expect(p.status).toBe("closed");
      expect(p.statusChangedAt).toEqual(now);
      expect(p.lastVerified).toBe("2026-11-10");
      const rows = await db.select().from(schema.reports);
      expect(rows.map((r) => r.resolvedAt)).toEqual([now, now]);
    });

    it("open keeps status, does not bump status_changed_at, updates last_verified, resolves", async () => {
      await report(1);
      await resolvePlace(db, 1, "open", now);
      const p = await place(1);
      expect(p.status).toBe("open");
      expect(p.statusChangedAt).toBeNull();
      expect(p.lastVerified).toBe("2026-11-10");
      expect((await db.select().from(schema.reports))[0].resolvedAt).toEqual(now);
    });

    it("does not bump status_changed_at when the status stays the same", async () => {
      await db.update(schema.places).set({ status: "closed", statusChangedAt: earlier });
      await resolvePlace(db, 1, "closed", now);
      expect((await place(1)).statusChangedAt).toEqual(earlier);
    });

    it("reopening a closed place bumps status_changed_at", async () => {
      await db.update(schema.places).set({ status: "closed", statusChangedAt: earlier });
      await resolvePlace(db, 1, "open", now);
      const p = await place(1);
      expect(p.status).toBe("open");
      expect(p.statusChangedAt).toEqual(now);
    });

    it("moved", async () => {
      await report(1, { kind: "moved" });
      await resolvePlace(db, 1, "moved", now);
      const p = await place(1);
      expect(p.status).toBe("moved");
      expect(p.statusChangedAt).toEqual(now);
      expect(p.lastVerified).toBe("2026-11-10");
      expect((await db.select().from(schema.reports))[0].resolvedAt).toEqual(now);
    });

    it("only that place's reports resolved, other place untouched", async () => {
      await report(1);
      await report(2);
      await resolvePlace(db, 1, "closed", now);
      const rows = await db.select().from(schema.reports).orderBy(schema.reports.placeId);
      expect(rows[0].resolvedAt).toEqual(now);
      expect(rows[1].resolvedAt).toBeNull();
      const other = await place(2);
      expect(other.status).toBe("open");
      expect(other.statusChangedAt).toBeNull();
      expect(other.lastVerified).toBe("2025-01-01");
    });

    it("already-resolved reports keep their original resolved_at", async () => {
      await report(1, { resolvedAt: earlier });
      await report(1);
      await resolvePlace(db, 1, "open", now);
      const rows = await db.select().from(schema.reports).orderBy(schema.reports.id);
      expect(rows[0].resolvedAt).toEqual(earlier);
      expect(rows[1].resolvedAt).toEqual(now);
    });

    it("throws for an unknown place and writes nothing", async () => {
      await report(1);
      await expect(resolvePlace(db, 999, "closed", now)).rejects.toThrow(/place 999 not found/);
      expect((await db.select().from(schema.reports))[0].resolvedAt).toBeNull();
      expect((await place(1)).status).toBe("open");
    });
  });

  describe("openReports", () => {
    it("puts flagged places first, then newest report first", async () => {
      await db.insert(schema.places).values({ slug: "c", name: "C", cityId: 1 });
      await report(1, { ipHash: "h1", createdAt: daysAgo(1) });
      await report(2, { ipHash: "h1", createdAt: daysAgo(2) });
      await report(2, { ipHash: "h2", createdAt: daysAgo(3), kind: "moved" });
      await report(3, { ipHash: "h1", createdAt: daysAgo(10) });
      await report(3, { ipHash: "h2", createdAt: daysAgo(11) });
      await report(3, { ipHash: "h3", createdAt: daysAgo(12) });
      const out = await openReports(db);
      expect(out.map((o) => [o.place.slug, o.flagged])).toEqual([
        ["c", true],
        ["a", false],
        ["b", false],
      ]);
      expect(out[0].place).toEqual({
        id: 3,
        slug: "c",
        name: "C",
        citySlug: "delhi",
        status: "open",
      });
      expect(out[0].reports.map((r) => r.createdAt)).toEqual([
        daysAgo(10),
        daysAgo(11),
        daysAgo(12),
      ]);
      expect(out[2].reports.map((r) => r.kind)).toEqual(["closed", "moved"]);
      expect(out[2].reports[0].message).toBe("m");
    });

    it("excludes resolved reports and places with only resolved reports", async () => {
      await report(1, { resolvedAt: earlier });
      await report(2, { resolvedAt: earlier });
      await report(2, { createdAt: daysAgo(1) });
      const out = await openReports(db);
      expect(out.map((o) => o.place.slug)).toEqual(["b"]);
      expect(out[0].reports).toHaveLength(1);
    });

    it("includes closed places so the admin can reopen them", async () => {
      await db.update(schema.places).set({ status: "closed" }).where(eq(schema.places.id, 1));
      await report(1);
      const out = await openReports(db);
      expect(out.map((o) => [o.place.slug, o.place.status])).toEqual([["a", "closed"]]);
    });

    it("returns an empty list when nothing is open", async () => {
      expect(await openReports(db)).toEqual([]);
    });
  });
});
