// One-off deep backfill: run the normal ingest and auto-review over each creator's
// last N uploads (yt-dlp), not just the RSS feed's latest 15.
// Usage: YTDLP_BIN=~/.local/bin/yt-dlp pnpm tsx worker/backfill.ts [perChannel=60] [creator-slug...]
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "../db";
import { autoReviewPending, checkPick, geocodeIndia } from "../lib/auto-review";
import { classifyVideo, gatedExtract } from "../lib/jev";
import { extractPicks } from "../lib/llm/extract";
import { notifyRevalidate } from "../lib/revalidate-client";
import { runIngest } from "../lib/worker/ingest";
import { listArchive, listUploadsWithFallback as listUploads, type Upload } from "../lib/youtube";

async function main() {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is required: it gates extraction and review");
  const perChannel = Number.parseInt(process.argv[2] ?? "60", 10);
  if (!(perChannel > 0)) throw new Error("perChannel must be a positive integer");
  const only = process.argv.slice(3);

  const creators = await db
    .select()
    .from(schema.creators)
    .where(
      and(
        eq(schema.creators.optedOut, false),
        isNotNull(schema.creators.ytChannelId),
        only.length ? inArray(schema.creators.slug, only) : undefined,
      ),
    );

  const archive = new Map<string, Upload[]>();
  for (const c of creators) {
    try {
      const uploads = await listArchive(c.ytChannelId!, perChannel);
      archive.set(c.ytChannelId!, uploads);
      console.log(`archive ${c.slug}: ${uploads.length} videos`);
    } catch (error) {
      console.error(`archive ${c.slug} failed:`, error);
    }
  }

  // Ingest skips videos it already has, so the `since` window is ignored here.
  const fromArchive = (async (id: string) =>
    archive.get(id) ?? listUploads(id)) as unknown as typeof listUploads;
  const ingest = await runIngest({
    db,
    listUploads: fromArchive,
    extract: gatedExtract(
      (video) => classifyVideo(video, { apiKey }),
      (video) => extractPicks(video),
    ),
    now: () => new Date(),
  });
  console.log(JSON.stringify({ ingest }));

  const review = await autoReviewPending({
    db,
    listUploads: async (id) => [
      ...(archive.get(id) ?? []),
      ...(await listUploads(id).catch(() => [])),
    ],
    check: (video, pick) => checkPick(video, pick, { apiKey }),
    geocode: geocodeIndia,
  });
  console.log(JSON.stringify({ autoReview: review }));
  if (review.approved > 0)
    console.log(JSON.stringify({ revalidated: await notifyRevalidate(["public"]) }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
