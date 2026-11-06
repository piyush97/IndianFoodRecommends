import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { schema, type Db } from "../db";
import { CITIES, cityBySlug } from "./cities";
import { parseSourceUrl } from "./source-url";
import { normalizeName } from "./text";

const PER_HOUR = 3;

/** "4:12" → 252, "1:02:05" → 3725, blank → null. */
export function parseTimestamp(raw: string | null | undefined): number | null {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  const m = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/.exec(value);
  if (!m) throw new Error("timestamp must look like 4:12 or 1:02:05");
  const [h, min, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (s > 59 || (m[1] !== undefined && min > 59)) throw new Error("timestamp out of range");
  return h * 3600 + min * 60 + s;
}

export const SubmitInput = z.object({
  url: z.string().trim().max(500),
  creatorSlug: z.string().trim().min(1).max(80),
  city: z.enum(CITIES.map((c) => c.slug) as [string, ...string[]]),
  placeName: z.string().trim().min(2).max(80),
  dishName: z.string().trim().min(2).max(60),
  timestamp: z.string().trim().max(10).optional(),
});
export type SubmitInput = z.infer<typeof SubmitInput>;

/**
 * Stores a visitor suggestion as a pending community pick. It is published only
 * if the daily auto-review finds the place in the creator's video text.
 */
export async function createSubmission(
  db: Db,
  raw: unknown,
  ipHash: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 429 }> {
  const parsed = SubmitInput.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400 };
  const input = parsed.data;
  const ref = parseSourceUrl(input.url);
  if (!ref) return { ok: false, status: 400 };
  let tsSeconds: number | null;
  try {
    tsSeconds = parseTimestamp(input.timestamp);
  } catch {
    return { ok: false, status: 400 };
  }
  const city = cityBySlug(input.city)!;

  return db.transaction(async (tx) => {
    // One submitter at a time per IP hash, so parallel posts cannot beat the limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`submit:${ipHash}`}))`);
    const recent = await tx
      .select({ id: schema.recommendations.id })
      .from(schema.recommendations)
      .where(
        and(
          eq(schema.recommendations.origin, "community"),
          gte(schema.recommendations.createdAt, new Date(now.getTime() - 3_600_000)),
          sql`${schema.recommendations.extracted}->>'submittedBy' = ${ipHash}`,
        ),
      );
    if (recent.length >= PER_HOUR) return { ok: false, status: 429 } as const;

    const [creator] = await tx
      .select()
      .from(schema.creators)
      .where(and(eq(schema.creators.slug, input.creatorSlug), eq(schema.creators.optedOut, false)));
    if (!creator) return { ok: false, status: 404 } as const;

    await tx
      .insert(schema.sources)
      .values({ ...ref, creatorId: creator.id })
      .onConflictDoNothing();
    const [source] = await tx
      .select()
      .from(schema.sources)
      .where(
        and(
          eq(schema.sources.platform, ref.platform),
          eq(schema.sources.externalId, ref.externalId),
        ),
      );

    // Same place already suggested or extracted for this video: nothing new to review.
    const existing = await tx
      .select({ extracted: schema.recommendations.extracted })
      .from(schema.recommendations)
      .where(eq(schema.recommendations.sourceId, source.id));
    const key = normalizeName(input.placeName);
    if (
      existing.some(
        (r) =>
          normalizeName((r.extracted as { place_name?: string } | null)?.place_name ?? "") === key,
      )
    ) {
      return { ok: true } as const;
    }

    await tx.insert(schema.recommendations).values({
      sourceId: source.id,
      status: "pending",
      origin: "community",
      tsSeconds,
      confidence: 0.6,
      createdAt: now,
      extracted: {
        place_name: input.placeName,
        locality: null,
        city: city.name,
        dishes: [input.dishName],
        timestamp_seconds: tsSeconds,
        confidence: 0.6,
        submitted: true,
        submittedBy: ipHash,
      },
    });
    return { ok: true } as const;
  });
}
