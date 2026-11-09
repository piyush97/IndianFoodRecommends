import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Db } from "./index";

/** Returns null when DATABASE_URL_TEST is unset, so DB tests skip cleanly. */
export function testDb(): { db: Db; close: () => Promise<void> } | null {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) return null;
  const client = postgres(url, { max: 2, prepare: false });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

export async function truncateAll(db: Db): Promise<void> {
  await db.execute(
    sql.raw(`TRUNCATE cities, creators, sources, places, dishes, recommendations, submissions,
     place_aliases, dish_aliases, reports, ingest_runs, search_misses, areas, area_aliases RESTART IDENTITY CASCADE`),
  );
}
