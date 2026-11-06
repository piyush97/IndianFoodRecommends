import { createHash } from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { schema, type Db } from "../db";

export const ReportInput = z.object({
  placeId: z.number().int().positive(),
  kind: z.enum(["closed", "moved", "wrong-info", "other"]),
  message: z.string().trim().max(500).optional(),
});
export type ReportInput = z.infer<typeof ReportInput>;

const PER_MINUTE = 5;

/** We keep only a salted hash so reports can be rate limited without storing IPs. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex");
}

export async function createReport(
  db: Db,
  raw: unknown,
  ipHash: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 429 }> {
  const parsed = ReportInput.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400 };
  const input = parsed.data;

  const [recent] = await db
    .select({ n: count() })
    .from(schema.reports)
    .where(
      and(
        eq(schema.reports.ipHash, ipHash),
        gte(schema.reports.createdAt, new Date(now.getTime() - 60_000)),
      ),
    );
  if (recent.n >= PER_MINUTE) return { ok: false, status: 429 };

  const [place] = await db
    .select({ id: schema.places.id })
    .from(schema.places)
    .where(eq(schema.places.id, input.placeId));
  if (!place) return { ok: false, status: 404 };

  await db.insert(schema.reports).values({
    placeId: input.placeId,
    kind: input.kind,
    message: input.message || null,
    ipHash,
    createdAt: now,
  });
  return { ok: true };
}
