import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { schema, type Db } from "../../../db";
import { truncateAll } from "../../../db/test-db";

const gate = vi.hoisted(() => ({ admin: false }));
const cache = vi.hoisted(() => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("../../../lib/auth", () => ({
  requireAdmin: async () => {
    if (!gate.admin) throw new Error("AuthError: forbidden");
    return { email: "admin@example.com" };
  },
}));
vi.mock("next/cache", () => cache);

// actions.ts imports the app `db` (DATABASE_URL, i.e. production): swap in the test database.
const handle = await vi.hoisted(async () => {
  const { testDb } = await import("../../../db/test-db");
  return testDb();
});
vi.mock("../../../db", async (importActual) => ({
  ...(await importActual<typeof import("../../../db")>()),
  db: handle?.db,
}));

const { approveAction, rejectAction, mergeAction, resolveReportAction, aliasMissAction } =
  await import("./actions");

const describeDb = handle ? describe : describe.skip;

describeDb("admin server actions", () => {
  const db = handle?.db as Db;

  beforeEach(async () => {
    gate.admin = false;
    cache.revalidateTag.mockClear();
    cache.revalidatePath.mockClear();
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
    const [rec] = await db.insert(schema.recommendations).values({ sourceId: 1 }).returning();
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
    const [rec] = await db.insert(schema.recommendations).values({ sourceId: 1 }).returning();
    await expect(rejectAction(rec.id)).rejects.toThrow();
    const [after] = await db.select().from(schema.recommendations);
    expect(after.status).toBe("pending");
  });

  it("refuses merge without an admin session", async () => {
    await expect(mergeAction(1, 2)).rejects.toThrow();
  });

  describe("resolveReportAction", () => {
    beforeEach(async () => {
      await db.insert(schema.places).values({ slug: "a", name: "A", cityId: 1 });
      await db.insert(schema.reports).values({ placeId: 1, kind: "closed" });
    });

    async function untouched() {
      const [p] = await db.select().from(schema.places);
      const [r] = await db.select().from(schema.reports);
      expect(p.status).toBe("open");
      expect(p.lastVerified).toBeNull();
      expect(r.resolvedAt).toBeNull();
    }

    it("refuses without an admin session and writes nothing", async () => {
      await expect(resolveReportAction(1, "closed")).rejects.toThrow(/forbidden/);
      await untouched();
      expect(cache.revalidateTag).not.toHaveBeenCalled();
    });

    it.each(["gone", "", "CLOSED", null, undefined, 1])(
      "rejects the outcome %j and writes nothing",
      async (outcome) => {
        gate.admin = true;
        await expect(resolveReportAction(1, outcome as never)).rejects.toThrow();
        await untouched();
        expect(cache.revalidateTag).not.toHaveBeenCalled();
      },
    );

    it.each([0, -1, 1.5, Number.NaN, "1", null, undefined])(
      "rejects the place id %j and writes nothing",
      async (placeId) => {
        gate.admin = true;
        await expect(resolveReportAction(placeId as never, "closed")).rejects.toThrow();
        await untouched();
        expect(cache.revalidateTag).not.toHaveBeenCalled();
      },
    );

    it("resolves the place and revalidates the public cache and the queue", async () => {
      gate.admin = true;
      await resolveReportAction(1, "closed");
      const [p] = await db.select().from(schema.places);
      expect(p.status).toBe("closed");
      const [r] = await db.select().from(schema.reports);
      expect(r.resolvedAt).not.toBeNull();
      expect(cache.revalidateTag).toHaveBeenCalledWith("public", "max");
      expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/reports");
    });
  });

  describe("aliasMissAction", () => {
    beforeEach(async () => {
      await db.insert(schema.dishes).values({ slug: "chole-bhature", name: "Chole Bhature" });
      await db.insert(schema.searchMisses).values({ query: "chhole bature" });
    });

    const form = (query: unknown, dishSlug: unknown) => {
      const f = new FormData();
      if (query !== undefined) f.set("query", query as string);
      if (dishSlug !== undefined) f.set("dishSlug", dishSlug as string);
      return f;
    };

    async function untouched() {
      expect(await db.select().from(schema.dishAliases)).toHaveLength(0);
      expect((await db.select().from(schema.searchMisses)).map((m) => m.query)).toEqual([
        "chhole bature",
      ]);
      expect(cache.revalidateTag).not.toHaveBeenCalled();
    }

    it("refuses without an admin session and writes nothing", async () => {
      await expect(aliasMissAction(form("chhole bature", "chole-bhature"))).rejects.toThrow(
        /forbidden/,
      );
      await untouched();
    });

    it.each([
      ["empty query", "", "chole-bhature"],
      ["blank query", "   ", "chole-bhature"],
      ["punctuation-only query", "!!", "chole-bhature"],
      ["too long query", "x".repeat(101), "chole-bhature"],
      ["missing query", undefined, "chole-bhature"],
      ["empty slug", "chhole bature", ""],
      ["too long slug", "chhole bature", "x".repeat(81)],
      ["missing slug", "chhole bature", undefined],
    ])("rejects %s and writes nothing", async (_name, query, dishSlug) => {
      gate.admin = true;
      await expect(aliasMissAction(form(query, dishSlug))).rejects.toThrow();
      await untouched();
    });

    it("rejects a file instead of a string", async () => {
      gate.admin = true;
      const f = form(undefined, "chole-bhature");
      f.set("query", new File(["x"], "x.txt"));
      await expect(aliasMissAction(f)).rejects.toThrow();
      await untouched();
    });

    it("adds the alias, clears the miss and revalidates", async () => {
      gate.admin = true;
      await aliasMissAction(form("chhole bature", "chole-bhature"));
      expect((await db.select().from(schema.dishAliases)).map((a) => a.alias)).toEqual([
        "chhole bature",
      ]);
      expect(await db.select().from(schema.searchMisses)).toHaveLength(0);
      expect(cache.revalidateTag).toHaveBeenCalledWith("public", "max");
      expect(cache.revalidatePath).toHaveBeenCalledWith("/admin/searches");
    });

    it("an unknown dish changes nothing", async () => {
      gate.admin = true;
      await aliasMissAction(form("chhole bature", "nope"));
      expect(await db.select().from(schema.dishAliases)).toHaveLength(0);
      expect(await db.select().from(schema.searchMisses)).toHaveLength(1);
    });
  });
});
