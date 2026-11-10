import { sql } from "drizzle-orm";
import type { Db } from "./index";

/**
 * Fills `places` with `extra` synthetic rows spread across the seeded cities, so
 * query plans can be checked at a realistic size instead of at seed size.
 * One statement, so it stays fast enough for CI. Returns the total row count.
 */
export async function seedPerfPlaces(db: Db, extra = 50_000): Promise<number> {
  // Own city, so the seed does not depend on (or race) the real seed data.
  await db.execute(sql`
    insert into cities (slug, name) values ('perf-city', 'Perf City')
    on conflict (slug) do nothing
  `);
  await db.execute(sql`
    insert into places (slug, name, city_id, locality, lat, lng)
    select
      'perf-place-' || g,
      'Perf ' || substr(md5(g::text), 1, 10),
      city.id,
      'Perf Locality ' || (g % 200),
      8.0 + (g % 3000) / 100.0,
      68.0 + (g % 3000) / 100.0
    from generate_series(1, ${extra}) as g
    cross join lateral (select id from cities where slug = 'perf-city') as city
    on conflict (slug) do nothing
  `);
  await db.execute(sql`analyze places`);
  const [row] = await db.execute<{ n: string }>(sql`select count(*)::text as n from places`);
  return Number(row.n);
}

/** Plan text for a query, as JSON, so a test can assert which index was chosen. */
export async function explain(db: Db, query: ReturnType<typeof sql>): Promise<string> {
  const rows = await db.execute<{ "QUERY PLAN": unknown }>(sql`explain (format json) ${query}`);
  return JSON.stringify(rows);
}
