import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { isReadOnlyError, readOnlySession } from "./guard";

const testUrl = process.env.DATABASE_URL_TEST;

// Same connection option db/index.ts sets on previews.
(testUrl ? describe : describe.skip)("read-only session", () => {
  it("refuses writes and still reads", async () => {
    const sql = postgres(testUrl!, {
      max: 1,
      prepare: false,
      connection: { options: "-c default_transaction_read_only=on" },
    });
    try {
      const [row] = await sql`show default_transaction_read_only`;
      expect(row.default_transaction_read_only).toBe("on");
      const write = sql`create temp table guard_probe (id int)`;
      await expect(write).rejects.toMatchObject({ code: "25006" });
      await expect(write.catch((e: unknown) => isReadOnlyError(e))).resolves.toBe(true);
      expect((await sql`select 1 as one`)[0].one).toBe(1);
    } finally {
      await sql.end();
    }
  });
});

describe("readOnlySession", () => {
  it("is read-only on a Vercel preview", () => {
    expect(readOnlySession({ VERCEL_ENV: "preview" })).toBe(true);
  });

  it("allows writes in production, development, CI and local", () => {
    for (const VERCEL_ENV of ["production", "development", undefined]) {
      expect(readOnlySession({ VERCEL_ENV })).toBe(false);
    }
  });

  it("lets a preview with its own database opt back in", () => {
    expect(readOnlySession({ VERCEL_ENV: "preview", PREVIEW_DB_WRITES: "1" })).toBe(false);
    expect(readOnlySession({ VERCEL_ENV: "preview", PREVIEW_DB_WRITES: "true" })).toBe(true);
  });
});

describe("isReadOnlyError", () => {
  it("finds SQLSTATE 25006 directly or through a Drizzle cause", () => {
    expect(isReadOnlyError({ code: "25006" })).toBe(true);
    expect(isReadOnlyError(new Error("wrapped", { cause: { code: "25006" } }))).toBe(true);
  });

  it("ignores other errors and non-errors", () => {
    expect(isReadOnlyError({ code: "23505" })).toBe(false);
    expect(isReadOnlyError(new Error("boom"))).toBe(false);
    expect(isReadOnlyError(null)).toBe(false);
    expect(isReadOnlyError("25006")).toBe(false);
  });
});
