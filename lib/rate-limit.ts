import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { isReadOnlyError } from "../db/guard";

export type RateLimitOptions = {
  /** Burst size: the most calls allowed back to back. */
  capacity: number;
  /** Tokens added per second. Zero means a hard cap per window. */
  refillPerSecond: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Milliseconds until one token is available, for a Retry-After header. */
  retryAfterMs: number;
};

/** Retry delay when the bucket never refills. */
const NO_REFILL_MS = 60_000;

/**
 * Postgres token bucket. The state lives in the database, so the limit holds
 * across serverless cold starts and across instances, unlike an in-process
 * counter. One row per key; the refill is computed from `updated_at`.
 *
 * The whole check is a single upsert: `on conflict do update` takes the row
 * lock, so concurrent calls queue behind it and cannot both spend one token.
 */
export async function takeToken(
  db: Db,
  key: string,
  { capacity, refillPerSecond }: RateLimitOptions,
): Promise<RateLimitResult> {
  if (capacity <= 0) return { ok: false, retryAfterMs: NO_REFILL_MS };

  try {
    return await spendToken(db, key, { capacity, refillPerSecond });
  } catch (error) {
    // A read-only preview session cannot record the spend; allow the call, do not 500.
    if (isReadOnlyError(error)) return { ok: true, retryAfterMs: 0 };
    throw error;
  }
}

async function spendToken(
  db: Db,
  key: string,
  { capacity, refillPerSecond }: RateLimitOptions,
): Promise<RateLimitResult> {
  // One statement: the inserted/updated row is locked, so a concurrent caller
  // waits and then re-evaluates the condition against the winner's tokens.
  const [row] = await db.execute<{ allowed: boolean }>(sql`
    insert into rate_limits (key, tokens, updated_at)
    values (${key}, ${capacity}::float8 - 1, now())
    on conflict (key) do update
      set tokens = least(
            ${capacity}::float8,
            rate_limits.tokens
              + extract(epoch from (now() - rate_limits.updated_at)) * ${refillPerSecond}::float8
          ) - 1,
          updated_at = now()
      where least(
            ${capacity}::float8,
            rate_limits.tokens
              + extract(epoch from (now() - rate_limits.updated_at)) * ${refillPerSecond}::float8
          ) >= 1
    returning 1 as allowed
  `);

  if (row?.allowed) return { ok: true, retryAfterMs: 0 };

  // Denied: report the delay from the stored balance.
  const [current] = await db.execute<{ available: string | number }>(sql`
    select least(
      ${capacity}::float8,
      tokens + extract(epoch from (now() - updated_at)) * ${refillPerSecond}::float8
    ) as available
    from rate_limits where key = ${key}
  `);
  const available = Number(current?.available ?? 0);

  if (refillPerSecond <= 0) return { ok: false, retryAfterMs: NO_REFILL_MS };
  const retryAfterMs = Math.ceil(((1 - available) / refillPerSecond) * 1000);
  return { ok: false, retryAfterMs: Math.max(1, retryAfterMs) };
}

/** Drops buckets untouched for a day, so keys from one-off visitors do not accumulate. */
export async function pruneRateLimits(db: Db): Promise<void> {
  await db.execute(sql`delete from rate_limits where updated_at < now() - interval '1 day'`);
}

/**
 * Client IP for the limit. Vercel sets x-forwarded-for; the browser sets
 * nothing, so unknown clients share one bucket rather than escaping the limit.
 * IPv6 is grouped by /64, the smallest block a single customer is normally
 * given, so rotating addresses inside one allocation cannot reset the limit.
 * IPv4-mapped IPv6 is treated as the IPv4 address it carries.
 */
export function clientIp(
  request: Request | { headers: { get(name: string): string | null } },
): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(":") || ip === "::1") return ip;

  const bare = ip.includes("%") ? ip.slice(0, ip.indexOf("%")) : ip;
  const [head = "", tail = ""] = bare.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const missing = Math.max(0, 8 - headGroups.length - tailGroups.length);
  const groups = [...headGroups, ...Array<string>(missing).fill("0"), ...tailGroups];
  const prefix = groups
    .slice(0, 4)
    .map((group) => group.toLowerCase().replace(/^0+(?=.)/, ""))
    .join(":");
  return `${prefix}::/64`;
}

/** Client key for the limit, built from the shared client IP. */
export function clientKey(
  request: Request | { headers: { get(name: string): string | null } },
  scope: string,
): string {
  return `${scope}:${clientIp(request)}`;
}
