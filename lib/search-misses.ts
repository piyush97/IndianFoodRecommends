import { desc, gt, sql } from "drizzle-orm";
import { schema, type Db } from "../db";
import { normalizeName } from "./text";

const MIN_LENGTH = 2;
const MAX_LENGTH = 60;
const KEEP_ONE_HIT_DAYS = 30;

/** Counts a search that returned nothing. Never throws: logging must not break search. */
export async function logMiss(db: Db, raw: string): Promise<void> {
  const query = normalizeName(raw.slice(0, 100));
  if (query.length < MIN_LENGTH || query.length > MAX_LENGTH) return;
  try {
    await db
      .insert(schema.searchMisses)
      .values({ query })
      .onConflictDoUpdate({
        target: schema.searchMisses.query,
        set: { hits: sql`${schema.searchMisses.hits} + 1`, lastAt: sql`now()` },
      });
    // Junk typed once never earns a place in the list; keep the table small.
    await db.execute(sql`
      delete from search_misses
      where hits = 1 and last_at < now() - make_interval(days => ${KEEP_ONE_HIT_DAYS})
    `);
  } catch (error) {
    console.error("search miss log failed", error);
  }
}

export type Miss = { query: string; hits: number; lastAt: Date };

/** Most searched dead ends in the last `days` days. */
export function topMisses(db: Db, days = 30, limit = 30): Promise<Miss[]> {
  return db
    .select()
    .from(schema.searchMisses)
    .where(gt(schema.searchMisses.lastAt, sql`now() - make_interval(days => ${days})`))
    .orderBy(desc(schema.searchMisses.hits), desc(schema.searchMisses.lastAt))
    .limit(limit);
}
