import { and, desc, eq, isNull, lte } from "drizzle-orm";
import { schema, type Db } from "../db";
import { flaggedPlaceIds } from "./trust";

export type OpenReportGroup = {
  place: {
    id: number;
    slug: string;
    name: string;
    citySlug: string;
    status: "open" | "closed" | "moved";
  };
  flagged: boolean;
  reports: { kind: string; message: string | null; createdAt: Date }[];
};

/** Unresolved reports grouped by place: flagged places first, then newest report first. */
export async function openReports(db: Db, now = new Date()): Promise<OpenReportGroup[]> {
  const { reports: r, places: p, cities: c } = schema;
  const rows = await db
    .select({
      id: p.id,
      slug: p.slug,
      name: p.name,
      citySlug: c.slug,
      status: p.status,
      kind: r.kind,
      message: r.message,
      createdAt: r.createdAt,
    })
    .from(r)
    .innerJoin(p, eq(p.id, r.placeId))
    .innerJoin(c, eq(c.id, p.cityId))
    .where(isNull(r.resolvedAt))
    .orderBy(desc(r.createdAt), desc(r.id));

  const groups = new Map<number, OpenReportGroup>();
  for (const row of rows) {
    let group = groups.get(row.id);
    if (!group) {
      const { id, slug, name, citySlug, status } = row;
      group = { place: { id, slug, name, citySlug, status }, flagged: false, reports: [] };
      groups.set(id, group);
    }
    group.reports.push({ kind: row.kind, message: row.message, createdAt: row.createdAt });
  }

  const flagged = await flaggedPlaceIds(db, [...groups.keys()], now);
  const out = [...groups.values()];
  for (const group of out) group.flagged = flagged.has(group.place.id);
  // Array sort is stable, so each half keeps its newest-report-first order.
  return out.sort((a, b) => Number(b.flagged) - Number(a.flagged));
}

/**
 * One transaction: set the status, stamp the verification date, resolve the open reports that
 * existed when the admin's page was rendered (`seenThrough`); reports that arrive later stay open.
 */
export async function resolvePlace(
  db: Db,
  placeId: number,
  outcome: "open" | "closed" | "moved",
  now = new Date(),
  seenThrough?: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [place] = await tx
      .select({ status: schema.places.status })
      .from(schema.places)
      .where(eq(schema.places.id, placeId))
      .for("update");
    if (!place) throw new Error(`place ${placeId} not found`);

    await tx
      .update(schema.places)
      .set({
        status: outcome,
        ...(place.status !== outcome && { statusChangedAt: now }),
        lastVerified: now.toISOString().slice(0, 10),
      })
      .where(eq(schema.places.id, placeId));
    await tx
      .update(schema.reports)
      .set({ resolvedAt: now })
      .where(
        and(
          eq(schema.reports.placeId, placeId),
          isNull(schema.reports.resolvedAt),
          seenThrough && lte(schema.reports.createdAt, seenThrough),
        ),
      );
  });
}
