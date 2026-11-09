import { sql } from "drizzle-orm";
import type { Db } from "../../db";
import { cityBySlug } from "../cities";

/** Top-level routes that are not cities. `known-paths.test.ts` fails when `app/` gains one that is missing here. */
export const STATIC_ROUTES = ["about", "admin", "api", "creator", "search", "submit"];

/** Slugs that have a page. A superset of what the pages show: a stale entry only means a 200 soft 404, never a wrong 404. */
export type PathIndex = {
  places: Set<string>;
  dishes: Set<string>;
  creators: Set<string>;
  areas: Set<string>;
  walks?: Set<string>;
};

export async function loadIndex(db: Db): Promise<PathIndex> {
  const rows = (await db.execute(sql`
    select 'place' as kind, ci.slug || '/' || p.slug as slug
    from places p join cities ci on ci.id = p.city_id
    where exists (select 1 from recommendations r where r.place_id = p.id and r.status = 'approved')
    union
    select 'dish', ci.slug || '/' || d.slug
    from recommendations r
    join places p on p.id = r.place_id
    join cities ci on ci.id = p.city_id
    join dishes d on d.id = r.dish_id
    where r.status = 'approved'
    union
    select 'creator', slug from creators
    union select 'area',ci.slug || '/' || a.slug from areas a join cities ci on ci.id=a.city_id
    union select 'walk',ci.slug || '/' || w.slug from food_walks w join cities ci on ci.id=w.city_id
  `)) as unknown as { kind: "place" | "dish" | "creator" | "area" | "walk"; slug: string }[];
  const index: PathIndex = {
    places: new Set(),
    dishes: new Set(),
    creators: new Set(),
    areas: new Set(),
    walks: new Set(),
  };
  const bucket = {
    place: index.places,
    dish: index.dishes,
    creator: index.creators,
    area: index.areas,
    walk: index.walks!,
  };
  for (const { kind, slug } of rows) bucket[kind].add(slug);
  return index;
}

/** Whether a public URL maps to a page that can exist. Anything unknown should answer 404 before rendering starts. */
export function isKnownPath(segments: string[], index: PathIndex): boolean {
  const [a, b, c] = segments;
  if (a === undefined) return true;
  // Metadata image routes (`opengraph-image-<hash>`) check their own params.
  if (segments.some((s) => s.startsWith("opengraph-image"))) return true;
  if (a === "admin" || a === "api") return true;
  if (STATIC_ROUTES.includes(a) && a !== "creator") return segments.length === 1;
  if (a === "creator") return segments.length <= 3 && b !== undefined && index.creators.has(b);
  if (!cityBySlug(a)) return false;
  if (segments.length === 1) return true;
  if (segments.length === 2) return b === "walks" || index.dishes.has(`${a}/${b}`);
  if (segments.length === 3 && b === "place") return index.places.has(`${a}/${c}`);
  if (segments.length === 3 && b === "area") return index.areas.has(`${a}/${c}`);
  if (segments.length === 3 && b === "walk") return index.walks?.has(`${a}/${c}`) ?? false;
  return false;
}
