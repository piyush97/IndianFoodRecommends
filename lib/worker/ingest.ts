import { and, desc, eq, isNotNull } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { matchDish, matchPlace, type Match } from "../matcher";
import { normalizeName } from "../text";
import { channelAvatar, listUploads, type Upload } from "../youtube";
import type { ExtractedPick } from "../llm/extract";

export type IngestDeps = {
  db: Db;
  listUploads: typeof listUploads;
  extract: (input: { title: string; description: string }) => Promise<ExtractedPick[]>;
  now: () => Date;
  channelAvatar?: typeof channelAvatar;
};

export type IngestSummary = { videos: number; picks: number; errors: number };

const LOCK_ID = 727001;
const ZERO: IngestSummary = { videos: 0, picks: 0, errors: 0 };
// First run per creator: the feed holds at most 15 uploads anyway, so look back a year
// to cover creators who post monthly.
const FIRST_RUN_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
// A partial run can leave older uploads unstored while a newer one advances the
// newest stored date, so creators with history are re-listed from a fixed lookback.
const RECHECK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function runIngest(deps: IngestDeps): Promise<IngestSummary> {
  const connection = await deps.db.$client.reserve();
  try {
    const [lock] = await connection<{ ok: boolean }[]>`
      select pg_try_advisory_lock(${LOCK_ID}) as ok
    `;
    if (!lock.ok) return { ...ZERO };
    try {
      return await ingest(deps);
    } finally {
      await connection`select pg_advisory_unlock(${LOCK_ID})`;
    }
  } finally {
    connection.release();
  }
}

async function ingest({
  db,
  listUploads,
  extract,
  now,
  channelAvatar: avatarFor = channelAvatar,
}: IngestDeps): Promise<IngestSummary> {
  const summary: IngestSummary = { ...ZERO };
  const [run] = await db
    .insert(schema.ingestRuns)
    .values({ platform: "youtube", externalId: "daily" })
    .returning();

  const cities = await db.select().from(schema.cities);
  const cityByName = new Map(cities.map((c) => [normalizeName(c.name), c.id]));

  try {
    const creators = await db
      .select()
      .from(schema.creators)
      .where(and(eq(schema.creators.optedOut, false), isNotNull(schema.creators.ytChannelId)));

    for (const creator of creators) {
      try {
        const avatarUrl = await avatarFor(creator.ytChannelId!);
        if (avatarUrl) {
          await db
            .update(schema.creators)
            .set({ avatarUrl })
            .where(eq(schema.creators.id, creator.id));
        }
      } catch (error) {
        // An avatar is a nicety: never let it stop this creator's uploads.
        console.error(`ingest: avatar for ${creator.ytChannelId} failed:`, error);
      }

      const [latest] = await db
        .select({ publishedOn: schema.sources.publishedOn })
        .from(schema.sources)
        .where(and(eq(schema.sources.creatorId, creator.id), isNotNull(schema.sources.publishedOn)))
        .orderBy(desc(schema.sources.publishedOn))
        .limit(1);

      const since = latest?.publishedOn
        ? new Date(now().getTime() - RECHECK_WINDOW_MS)
        : new Date(now().getTime() - FIRST_RUN_WINDOW_MS);

      let uploads: Upload[];
      try {
        uploads = await listUploads(creator.ytChannelId!, { since });
      } catch (error) {
        summary.errors++;
        console.error(`ingest: feed for ${creator.ytChannelId} failed:`, error);
        continue;
      }

      for (const upload of uploads) {
        if (await alreadyIngested(db, upload)) continue;

        try {
          // Extract and match before writing anything: a failed LLM call must
          // leave no `sources` row, or the next run would skip this video forever.
          const picks = await extract({ title: upload.title, description: upload.description });
          const rows: Omit<typeof schema.recommendations.$inferInsert, "sourceId">[] = [];
          for (const pick of picks) {
            const cityId = pick.city ? cityByName.get(normalizeName(pick.city)) : undefined;
            const suggestions = {
              places: cityId ? await matchPlace(db, pick.place_name, cityId) : [],
              dishes: await matchPicks(db, pick.dishes),
            };
            rows.push({
              tsSeconds: pick.timestamp_seconds,
              confidence: pick.confidence,
              extracted: { ...pick, suggestions },
            });
          }

          const inserted = await db.transaction(async (tx) => {
            const [source] = await tx
              .insert(schema.sources)
              .values({
                platform: "youtube",
                externalId: upload.videoId,
                creatorId: creator.id,
                publishedOn: upload.publishedAt.toISOString().slice(0, 10),
              })
              .onConflictDoNothing()
              .returning();
            if (!source) return false;
            if (rows.length > 0) {
              await tx
                .insert(schema.recommendations)
                .values(rows.map((r) => ({ ...r, sourceId: source.id })));
            }
            return true;
          });
          if (!inserted) continue;
          summary.videos++;
          summary.picks += rows.length;
        } catch (error) {
          summary.errors++;
          console.error(`ingest: ${upload.videoId} failed:`, error);
        }
      }
    }
    await db
      .update(schema.ingestRuns)
      .set({ status: "ok", finishedAt: new Date() })
      .where(eq(schema.ingestRuns.id, run.id));
    return summary;
  } catch (error) {
    await db
      .update(schema.ingestRuns)
      .set({ status: "failed", error: String(error), finishedAt: new Date() })
      .where(eq(schema.ingestRuns.id, run.id));
    throw error;
  }

  async function alreadyIngested(db: Db, upload: Upload): Promise<boolean> {
    const [row] = await db
      .select({ id: schema.sources.id })
      .from(schema.sources)
      .where(
        and(eq(schema.sources.platform, "youtube"), eq(schema.sources.externalId, upload.videoId)),
      )
      .limit(1);
    return Boolean(row);
  }
}

async function matchPicks(db: Db, names: string[]): Promise<Match[]> {
  const seen = new Map<number, Match>();
  for (const name of names) {
    for (const match of await matchDish(db, name)) {
      const current = seen.get(match.id);
      if (!current || match.score > current.score) seen.set(match.id, match);
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}
