import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { geocodeDelhi } from "../lib/auto-review";

/** One-off: give places without coordinates a shop or locality-level pin. */
async function main(): Promise<void> {
  const rows = await db
    .select()
    .from(schema.places)
    .where(and(isNull(schema.places.lat), isNotNull(schema.places.name)));
  let fixed = 0;
  for (const place of rows) {
    const exact = await geocodeDelhi(
      [place.name, place.locality, "Delhi"].filter(Boolean).join(", "),
    );
    const area = exact || !place.locality ? null : await geocodeDelhi(`${place.locality}, Delhi`);
    const hit = exact ?? (area ? { ...area, osmId: `approx:${area.osmId}` } : null);
    if (!hit) continue;
    await db
      .update(schema.places)
      .set({ lat: hit.lat, lng: hit.lng, osmId: hit.osmId })
      .where(eq(schema.places.id, place.id));
    fixed++;
  }
  console.log(JSON.stringify({ missing: rows.length, fixed }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
