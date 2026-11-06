import { sql } from "drizzle-orm";
import type { Db } from "../db";

const STALE_DAYS = 365;

export type StalePlace = {
  slug: string;
  name: string;
  citySlug: string;
  lastVerified: string | null;
  picks: number;
};

/** Public places not verified within a year (or never), oldest first. */
export async function stalePlaces(db: Db, now = new Date()): Promise<StalePlace[]> {
  const cutoff = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const rows = (await db.execute(sql`
    select p.slug, p.name, ci.slug as city_slug, p.last_verified::text as last_verified,
           count(*)::int as picks
    from places p
    join cities ci on ci.id = p.city_id
    join recommendations r on r.place_id = p.id and r.status = 'approved'
    join sources s on s.id = r.source_id
    join creators c on c.id = s.creator_id and c.opted_out = false
    where p.last_verified is null or p.last_verified < ${cutoff}::date
    group by p.id, ci.slug
    order by p.last_verified asc nulls first, p.name
  `)) as unknown as {
    slug: string;
    name: string;
    city_slug: string;
    last_verified: string | null;
    picks: number;
  }[];
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    citySlug: r.city_slug,
    lastVerified: r.last_verified,
    picks: r.picks,
  }));
}
