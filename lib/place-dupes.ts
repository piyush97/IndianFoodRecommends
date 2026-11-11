import { sql } from "drizzle-orm";
import type { Db } from "../db";

export type PlaceRef = { id: number; name: string; locality: string | null; picks: number };
export type PlaceDupe = { a: PlaceRef; b: PlaceRef };

/** Publicly visible places in the same city with near-identical names ("Mann-O-Salwa" next to "Mann O Salwa"), closest first. */
export async function placeDuplicates(db: Db): Promise<PlaceDupe[]> {
  return (await db.execute(sql`
    with visible as (
      select p.id, p.name, p.locality, p.city_id, count(*)::int as picks
      from places p
      join recommendations r on r.place_id = p.id and r.status = 'approved'
      join sources s on s.id = r.source_id
      join creators c on c.id = s.creator_id and c.opted_out = false
      where p.status <> 'closed'
      group by p.id
    )
    select json_build_object('id', a.id, 'name', a.name, 'locality', a.locality, 'picks', a.picks) as a,
           json_build_object('id', b.id, 'name', b.name, 'locality', b.locality, 'picks', b.picks) as b
    from visible a
    join visible b on b.city_id = a.city_id and a.id < b.id
      and similarity(lower(a.name), lower(b.name)) >= 0.6
    order by similarity(lower(a.name), lower(b.name)) desc, a.name, b.name, a.id, b.id
  `)) as unknown as PlaceDupe[];
}
