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
 * The whole check is a single statement, so two concurrent calls cannot both
 * spend the same token.
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
  const [row] = await db.execute<{ available: string | number; allowed: boolean }>(sql`
    with current as (
      select tokens, updated_at from rate_limits where key = ${key}
    ),
    calc as (
      select least(
        ${capacity}::float8,
        coalesce(current.tokens, ${capacity}::float8)
          + extract(epoch from (now() - coalesce(current.updated_at, now()))) * ${refillPerSecond}::float8
      ) as available
      from (values (1)) as one left join current on true
    ),
    spend as (
      insert into rate_limits (key, tokens, updated_at)
      select ${key}, calc.available - 1, now() from calc where calc.available >= 1
      on conflict (key) do update set tokens = excluded.tokens, updated_at = excluded.updated_at
      returning 1
    )
    select calc.available, exists (select 1 from spend) as allowed from calc
  `);

  const available = Number(row?.available ?? 0);
  if (row?.allowed) return { ok: true, retryAfterMs: 0 };

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
