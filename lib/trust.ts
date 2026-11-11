import { and, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { schema, type Db } from "../db";

export const FLAG_MIN = 3;
export const FLAG_DAYS = 60;

/**
 * Places that visitors say are closed or moved: at least FLAG_MIN distinct non-null `ip_hash`
 * among unresolved closed/moved reports from the last FLAG_DAYS. The value is "moved" only when
 * every counted report says moved. One query for all ids.
 */
export async function flaggedPlaces(
  db: Db,
  placeIds: number[],
  now = new Date(),
): Promise<Map<number, "closed" | "moved">> {
  if (placeIds.length === 0) return new Map();
  const r = schema.reports;
  const since = new Date(now.getTime() - FLAG_DAYS * 86_400_000);
  const rows = await db
    .select({ placeId: r.placeId, allMoved: sql<boolean>`bool_and(${r.kind} = 'moved')` })
    .from(r)
    .where(
      and(
        // One array parameter, not one per id: the near-me index passes every place, and
        // Postgres caps a statement at 65,535 parameters. Ids are integers, so the literal is safe.
        sql`${r.placeId} = any(${`{${placeIds.map((id) => Math.trunc(id)).join(",")}}`}::int[])`,
        inArray(r.kind, ["closed", "moved"]),
        isNotNull(r.ipHash),
        gt(r.createdAt, since),
        isNull(r.resolvedAt),
      ),
    )
    .groupBy(r.placeId)
    .having(sql`count(distinct ${r.ipHash}) >= ${FLAG_MIN}`);
  return new Map(rows.map((row) => [row.placeId, row.allMoved ? "moved" : "closed"] as const));
}

export async function flaggedPlaceIds(
  db: Db,
  placeIds: number[],
  now = new Date(),
): Promise<Set<number>> {
  return new Set((await flaggedPlaces(db, placeIds, now)).keys());
}
