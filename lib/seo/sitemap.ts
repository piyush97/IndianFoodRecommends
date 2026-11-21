import { sql } from "drizzle-orm";
import type { Db } from "../../db";
import { getWalks } from "../public/spatial";

type Entry = { path: string; lastModified: Date };

/** Every public URL with at least one approved pick from a creator who has not opted out, at a place that is not closed. */
export async function sitemapPaths(db: Db): Promise<Entry[]> {
  const rows = (await db.execute(sql`
    with visible as (
      select ci.slug as city, d.slug as dish, p.slug as place, c.slug as creator,
             coalesce(r.reviewed_at, r.created_at) as at, p.geom, p.city_id
      from recommendations r
      join sources s on s.id = r.source_id
      join creators c on c.id = s.creator_id
      join places p on p.id = r.place_id
      join dishes d on d.id = r.dish_id
      join cities ci on ci.id = p.city_id
      where r.status = 'approved' and c.opted_out = false and p.status <> 'closed'
    )
    select '/' as path, max(at) as at from visible
    union all select '/creators', max(at) from visible
    union all select '/about', max(at) from visible
    union all select '/submit', max(at) from visible
    union all select '/' || city, max(at) from visible group by city
    union all select '/' || city || '/agree', max(at) from visible
      where (city, place) in (select city, place from visible group by city, place
        having count(distinct creator) >= 2)
      group by city
    union all select '/' || city || '/' || dish, max(at) from visible group by city, dish
    union all select '/' || city || '/place/' || place, max(at) from visible group by city, place
    union all select '/creator/' || creator, max(at) from visible group by creator
    union all select '/' || v.city || '/area/' || a.slug,max(v.at) from visible v
      join areas a on a.city_id=v.city_id where case when a.boundary is not null
        then ST_Covers(a.boundary,v.geom::geometry)
        else ST_DWithin(v.geom,ST_SetSRID(ST_MakePoint(a.lng,a.lat),4326)::geography,1000) end
      group by v.city,a.slug
  `)) as unknown as { path: string; at: Date | string | null }[];

  const entries = rows
    .filter((r) => r.at !== null)
    .map((r) => ({ path: r.path, lastModified: new Date(r.at!) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const walks = await getWalks(db);
  const cities = new Set<string>();
  for (const walk of walks) {
    const lastModified = new Date(walk.updatedAt);
    entries.push({ path: `/${walk.citySlug}/walk/${walk.slug}`, lastModified });
    if (!cities.has(walk.citySlug)) entries.push({ path: `/${walk.citySlug}/walks`, lastModified });
    cities.add(walk.citySlug);
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
