import { sql } from "drizzle-orm";
import type { Db } from "../../db";

type Entry = { path: string; lastModified: Date };

/** Every public URL with at least one approved pick from a creator who has not opted out. */
export async function sitemapPaths(db: Db): Promise<Entry[]> {
  const rows = (await db.execute(sql`
    with visible as (
      select ci.slug as city, d.slug as dish, p.slug as place, c.slug as creator,
             coalesce(r.reviewed_at, r.created_at) as at
      from recommendations r
      join sources s on s.id = r.source_id
      join creators c on c.id = s.creator_id
      join places p on p.id = r.place_id
      join dishes d on d.id = r.dish_id
      join cities ci on ci.id = p.city_id
      where r.status = 'approved' and c.opted_out = false
    )
    select '/' as path, max(at) as at from visible
    union all select '/about', max(at) from visible
    union all select '/' || city, max(at) from visible group by city
    union all select '/' || city || '/' || dish, max(at) from visible group by city, dish
    union all select '/' || city || '/place/' || place, max(at) from visible group by city, place
    union all select '/creator/' || creator, max(at) from visible group by creator
  `)) as unknown as { path: string; at: Date | string | null }[];

  return rows
    .filter((r) => r.at !== null)
    .map((r) => ({ path: r.path, lastModified: new Date(r.at!) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
