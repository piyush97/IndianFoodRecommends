import { sql } from "drizzle-orm";
import type { Db } from "../../db";
import { samePlace } from "../matcher";
import type { PlaceRef } from "../place-dupes";
import { mergePlaces } from "../review";

export type DedupeGroup = { keep: PlaceRef; merge: PlaceRef[] };

/**
 * Groups visible places in one city that `samePlace` calls one shop. Each group keeps
 * the place with the most picks (then the oldest) and only takes places that match
 * that kept place itself, so a chain A=B, B=C never merges A into C by way of B.
 * Changes nothing unless `apply`.
 */
export async function dedupePlaces(
  db: Db,
  { apply = false }: { apply?: boolean } = {},
): Promise<DedupeGroup[]> {
  const rows = (await db.execute(sql`
    select p.id, p.name, p.locality, p.city_id as "cityId", count(*)::int as picks
    from places p
    join recommendations r on r.place_id = p.id and r.status = 'approved'
    join sources s on s.id = r.source_id
    join creators c on c.id = s.creator_id and c.opted_out = false
    where p.status <> 'closed'
    group by p.id
    order by picks desc, p.id
  `)) as unknown as (PlaceRef & { cityId: number })[];
  const places = rows.map(({ cityId, ...ref }) => ({ cityId, ref }));

  const groups: DedupeGroup[] = [];
  const taken = new Set<number>();
  for (const { cityId, ref: keep } of places) {
    if (taken.has(keep.id)) continue;
    const merge = places
      .filter((p) => p.cityId === cityId && p.ref.id !== keep.id && !taken.has(p.ref.id))
      .map((p) => p.ref)
      .filter((p) => samePlace(keep, p));
    if (merge.length === 0) continue;
    for (const p of merge) taken.add(p.id);
    taken.add(keep.id);
    groups.push({ keep, merge });
  }

  if (apply) {
    for (const g of groups) for (const p of g.merge) await mergePlaces(db, p.id, g.keep.id);
  }
  return groups;
}
