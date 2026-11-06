import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { normalizeName } from "./text";

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
  return bestMatches(db, DISHES, name);
}
