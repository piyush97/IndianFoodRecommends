import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Db } from "../db";
import * as schema from "../db/schema";
import { testDb } from "../db/test-db";
import { takeToken } from "./rate-limit";

const handle = testDb();
const describeDb = handle ? describe : describe.skip;

describeDb("takeToken", () => {
  let db: Db;
  beforeAll(async () => {
    db = handle!.db;
  });

  async function reset(key: string) {
    await db.execute(sql`delete from rate_limits where key = ${key}`);
  }

  it("allows a burst up to capacity then denies", async () => {
    const key = `burst:${Date.now()}`;
    await reset(key);
    const opts = { capacity: 3, refillPerSecond: 0 };
    expect((await takeToken(db, key, opts)).ok).toBe(true);
    expect((await takeToken(db, key, opts)).ok).toBe(true);
    expect((await takeToken(db, key, opts)).ok).toBe(true);
    const denied = await takeToken(db, key, opts);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterMs).toBe(60_000);
  });

  it("refills over time and caps at capacity", async () => {
    const key = `refill:${Date.now()}`;
    await reset(key);
    const opts = { capacity: 2, refillPerSecond: 1 };
    await takeToken(db, key, opts);
    await takeToken(db, key, opts);
    expect((await takeToken(db, key, opts)).ok).toBe(false);

    // Age the bucket by two seconds: two tokens are back, but never more than capacity.
    await db.execute(
      sql`update rate_limits set updated_at = updated_at - interval '2 seconds' where key = ${key}`,
    );
    expect((await takeToken(db, key, opts)).ok).toBe(true);
    expect((await takeToken(db, key, opts)).ok).toBe(true);
    expect((await takeToken(db, key, opts)).ok).toBe(false);

    await db.execute(
      sql`update rate_limits set updated_at = updated_at - interval '1 hour' where key = ${key}`,
    );
    await takeToken(db, key, opts);
    const [row] = await db.execute<{ tokens: number }>(
      sql`select tokens from rate_limits where key = ${key}`,
    );
    expect(Number(row.tokens)).toBeLessThanOrEqual(1);
  });

  it("keeps the bucket in Postgres, so a new connection sees the same state", async () => {
    const key = `shared:${Date.now()}`;
    await reset(key);
    const opts = { capacity: 1, refillPerSecond: 0 };
    expect((await takeToken(db, key, opts)).ok).toBe(true);

    const other = testDb();
    expect(other).not.toBeNull();
    try {
      // A cold instance holds no in-memory state; only the row can deny this call.
      expect((await takeToken(other!.db, key, opts)).ok).toBe(false);
    } finally {
      await other!.close();
    }
  });

  it("reports a retry delay that matches the refill rate", async () => {
    const key = `retry:${Date.now()}`;
    await reset(key);
    const opts = { capacity: 1, refillPerSecond: 0.5 };
    await takeToken(db, key, opts);
    const denied = await takeToken(db, key, opts);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThanOrEqual(1900);
    expect(denied.retryAfterMs).toBeLessThanOrEqual(2000);
  });

  it("lets a read-only preview session through instead of failing", async () => {
    const client = postgres(process.env.DATABASE_URL_TEST!, {
      max: 1,
      prepare: false,
      connection: { options: "-c default_transaction_read_only=on" },
    });
    try {
      const readOnly = drizzle(client, { schema }) as unknown as Db;
      const result = await takeToken(readOnly, `ro:${Date.now()}`, {
        capacity: 1,
        refillPerSecond: 0,
      });
      expect(result).toEqual({ ok: true, retryAfterMs: 0 });
    } finally {
      await client.end();
    }
  });
});
