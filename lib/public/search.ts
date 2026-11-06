import { sql } from "drizzle-orm";
import type { Db } from "../../db";
import { normalizeName } from "../text";

export type SearchResults = {
  dishes: { slug: string; name: string; citySlug: string }[];
  places: { slug: string; name: string; locality: string | null; citySlug: string }[];
  creators: { slug: string; name: string }[];
};

const EMPTY: SearchResults = { dishes: [], places: [], creators: [] };
const MIN_SIMILARITY = 0.3;
const LIMIT = 10;

/** `%`, `_` and `\` match literally inside ILIKE. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// A row is public when its pick is approved and its creator has not opted out.
const VISIBLE = sql`r.status = 'approved' and c.opted_out = false`;

export async function searchAll(db: Db, raw: string): Promise<SearchResults> {
  const q = normalizeName(raw.slice(0, 100));
  if (!q) return EMPTY;
  const like = likePattern(q);
  const hit = (col: string) =>
    sql`(similarity(lower(${sql.raw(col)}), ${q}) >= ${MIN_SIMILARITY} or lower(${sql.raw(col)}) ilike ${like})`;
  const score = (col: string) => sql`similarity(lower(${sql.raw(col)}), ${q})`;

  const [dishes, places, creators] = await Promise.all([
    db.execute(sql`
      select d.slug, d.name, ci.slug as city_slug, max(greatest(${score("d.name")}, coalesce(${score("a.alias")}, 0))) as score
      from dishes d
      left join dish_aliases a on a.dish_id = d.id
      join recommendations r on r.dish_id = d.id
      join sources s on s.id = r.source_id
      join creators c on c.id = s.creator_id
      join places p on p.id = r.place_id
      join cities ci on ci.id = p.city_id
      where ${VISIBLE} and (${hit("d.name")} or (a.alias is not null and ${hit("a.alias")}))
      group by d.slug, d.name, ci.slug
      order by score desc, d.name
      limit ${LIMIT}`),
    db.execute(sql`
      select p.slug, p.name, p.locality, ci.slug as city_slug, max(greatest(${score("p.name")}, coalesce(${score("a.alias")}, 0))) as score
      from places p
      left join place_aliases a on a.place_id = p.id
      join recommendations r on r.place_id = p.id
      join sources s on s.id = r.source_id
      join creators c on c.id = s.creator_id
      join cities ci on ci.id = p.city_id
      where ${VISIBLE} and (${hit("p.name")} or (a.alias is not null and ${hit("a.alias")}))
      group by p.slug, p.name, p.locality, ci.slug
      order by score desc, p.name
      limit ${LIMIT}`),
    db.execute(sql`
      select c.slug, c.name, max(${score("c.name")}) as score
      from creators c
      join sources s on s.creator_id = c.id
      join recommendations r on r.source_id = s.id
      where ${VISIBLE} and ${hit("c.name")}
      group by c.slug, c.name
      order by score desc, c.name
      limit ${LIMIT}`),
  ]);

  type Row = Record<string, string | null>;
  return {
    dishes: (dishes as unknown as Row[]).map((r) => ({
      slug: r.slug!,
      name: r.name!,
      citySlug: r.city_slug!,
    })),
    places: (places as unknown as Row[]).map((r) => ({
      slug: r.slug!,
      name: r.name!,
      locality: r.locality,
      citySlug: r.city_slug!,
    })),
    creators: (creators as unknown as Row[]).map((r) => ({ slug: r.slug!, name: r.name! })),
  };
}
