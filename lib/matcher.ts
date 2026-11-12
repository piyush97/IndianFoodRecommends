import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { canonicalDishName, normalizeName, placeKey, trigramSimilarity } from "./text";

export type Match = { id: number; name: string; score: number; via: "name" | "alias" };

type Row = { id: number; name: string; score: number; via: "name" | "alias" };

type Entity = { table: string; aliasTable: string; fk: string; cityScoped: boolean };

const PLACES: Entity = {
  table: "places",
  aliasTable: "place_aliases",
  fk: "place_id",
  cityScoped: true,
};
const DISHES: Entity = {
  table: "dishes",
  aliasTable: "dish_aliases",
  fk: "dish_id",
  cityScoped: false,
};

async function bestMatches(
  db: Db,
  entity: Entity,
  name: string,
  cityId?: number,
): Promise<Match[]> {
  const input = normalizeName(name);
  if (!input) return [];
  const scope = cityId === undefined ? sql`` : sql`where e.city_id = ${cityId}`;

  const rows = (await db.execute(sql`
    with candidates as (
      select e.id, e.name, case when lower(e.name) = ${input} then 1 else similarity(lower(e.name), ${input}) end as score, 'name' as via
      from ${sql.raw(entity.table)} e
      ${scope}
      union all
      select e.id, e.name, case when lower(a.alias) = ${input} then 1 else similarity(lower(a.alias), ${input}) end as score, 'alias' as via
      from ${sql.raw(entity.table)} e
      join ${sql.raw(entity.aliasTable)} a on a.${sql.raw(entity.fk)} = e.id
      ${scope}
    )
    select id, name, score, via from (
      select distinct on (id) id, name, score, via
      from candidates
      where score >= 0.6
      order by id, score desc
    ) best
    order by score desc
    limit 5
  `)) as unknown as Row[];

  return rows.map((r) => ({ id: r.id, name: r.name, score: Number(r.score), via: r.via }));
}

export function matchPlace(db: Db, name: string, cityId: number): Promise<Match[]> {
  return bestMatches(db, PLACES, name, cityId);
}

export function matchDish(db: Db, name: string): Promise<Match[]> {
  return bestMatches(db, DISHES, canonicalDishName(name));
}

type PlaceName = { name: string; locality: string | null };

/** Keys at or above this trigram similarity are spelling variants (rabdi/rabri, economy/economic). */
const SAME_PLACE_SIMILARITY = 0.7;

const squash = (s: string | null) => normalizeName(s ?? "").replace(/ /g, "");

/** Two localities name different areas; an empty one, or one inside the other, does not. */
function localitiesConflict(a: string | null, b: string | null): boolean {
  const [x, y] = [squash(a), squash(b)];
  return x !== "" && y !== "" && !x.includes(y) && !y.includes(x);
}

/** Whether two places in one city are the same shop. Errs towards "different". */
export function samePlace(a: PlaceName, b: PlaceName): boolean {
  const [ka, kb] = [placeKey(a.name, a.locality), placeKey(b.name, b.locality)];
  if (!ka || !kb || localitiesConflict(a.locality, b.locality)) return false;
  if (ka === kb) return true;
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  if (long.startsWith(`${short} `) && (short.includes(" ") || short.length >= 6)) return true;
  return trigramSimilarity(ka, kb) >= SAME_PLACE_SIMILARITY;
}

/**
 * The existing place in the city that `samePlace` accepts, by name or alias, read
 * now rather than at ingest. Closest key first, then the oldest place.
 */
export async function findSamePlace(
  db: Db,
  place: PlaceName,
  cityId: number,
): Promise<Match | undefined> {
  const input = normalizeName(place.name);
  if (!input) return undefined;
  // Loose prefilter; samePlace decides.
  const rows = (await db.execute(sql`
    select p.id, p.name, p.locality, n.text, n.via
    from places p
    cross join lateral (
      select p.name as text, 'name' as via
      union all
      select a.alias, 'alias' from place_aliases a where a.place_id = p.id
    ) n
    where p.city_id = ${cityId}
      and (similarity(lower(n.text), ${input}) >= 0.3
        or word_similarity(${input}, lower(n.text)) >= 0.5
        or word_similarity(lower(n.text), ${input}) >= 0.5)
  `)) as unknown as (Row & { locality: string | null; text: string })[];

  const key = placeKey(place.name, place.locality);
  return rows
    .filter((r) => samePlace(place, { name: r.text, locality: r.locality }))
    .map((r) => ({
      id: r.id,
      name: r.name,
      via: r.via,
      score: trigramSimilarity(key, placeKey(r.text, r.locality)),
    }))
    .sort((x, y) => y.score - x.score || x.id - y.id)[0];
}
