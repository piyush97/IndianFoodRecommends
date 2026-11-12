import { readFile } from "node:fs/promises";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "../db";
import {
  autoReviewPending,
  checkPick,
  geocodeIndia,
  type AutoReviewDeps,
} from "../lib/auto-review";
import { classifyVideo, gatedExtract } from "../lib/jev";
import { readLocalities, syncAreas } from "../lib/areas";
import { fillDiets } from "../lib/diet";
import { extractPicks } from "../lib/llm/extract";
import { listArchive, listUploadsWithFallback as listUploads } from "../lib/youtube";
import { runIngest } from "../lib/worker/ingest";
import { runEval, type Labelled } from "../lib/worker/eval";
import { notifyRevalidate } from "../lib/revalidate-client";
import { importOsmAreas } from "../lib/worker/osm-areas";
import { refreshHeatmap, refreshWalks } from "../lib/worker/geo";
import { recordRun } from "../lib/worker/run-log";
import { retryUnchecked } from "../lib/worker/retry-unchecked";

// With a TypeSafe key, Jev screens each video before the LLM reads it.
function extractor() {
  const llm = (video: { title: string; description: string }) => extractPicks(video);
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return llm;
  return gatedExtract((video) => classifyVideo(video, { apiKey }), llm);
}

async function ingest(): Promise<void> {
  const summary = await runIngest({ db, listUploads, extract: extractor(), now: () => new Date() });
  console.log(JSON.stringify(summary));
  await review();
  // Labelling is a nicety: a failure must not fail the ingest or fire the alert.
  await diet().catch((error) => console.error("diet:", error));
  await areas().catch((error) => console.error("areas:", error));
  await geo().catch((error) => console.error("geo:", error));
}

async function geo(): Promise<void> {
  const city = process.argv[2] === "geo" ? process.argv[3] : undefined;
  const walks = await refreshWalks(db, city);
  const heatmap = await refreshHeatmap(db, city);
  console.log(JSON.stringify({ walks, heatmap }));
  await notifyRevalidate(["public"]);
}

/** Rebuilds the area list the "sort from an area" search reads, from the places' localities. */
async function areas(): Promise<void> {
  const result = await syncAreas(db, await readLocalities(db));
  console.log(JSON.stringify({ areas: result }));
}

/** Labels new dishes veg / non-veg / mixed for the diet filter. */
async function diet(): Promise<void> {
  const labelled = await fillDiets(db);
  console.log(JSON.stringify({ dietLabelled: labelled }));
  if (labelled > 0)
    console.log(JSON.stringify({ revalidated: await notifyRevalidate(["public"]) }));
}

const reviewDeps = (apiKey: string): AutoReviewDeps => ({
  db,
  listUploads: (channelId) => listUploads(channelId),
  // Archive reaches past the feed's latest 15, which is what makes retry-unchecked worthwhile.
  listArchive: (channelId) => listArchive(channelId, 100),
  check: (video, pick) => checkPick(video, pick, { apiKey }),
  geocode: geocodeIndia,
});

/** Re-checks LLM picks rejected because their video text was never found. */
async function retry(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.log("retry-unchecked: TYPESAFE_API_KEY unset, nothing re-opened");
    return;
  }
  const retried = await retryUnchecked(reviewDeps(apiKey));
  console.log(JSON.stringify({ retryUnchecked: retried }));
  if (retried.approved > 0) {
    const ok = await notifyRevalidate(["public"]);
    console.log(JSON.stringify({ revalidated: ok }));
  }
}

/** Decides every pending pick. Fails the run (and so fires the alert) when LLM picks stay pending over 48 h. */
async function review(): Promise<void> {
  // No human queue: Jev verifies each pick and code approves or rejects it.
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.log("auto-review: TYPESAFE_API_KEY unset, picks stay pending");
    return;
  }
  const review = await autoReviewPending(reviewDeps(apiKey));
  console.log(JSON.stringify({ autoReview: review }));
  if (review.approved > 0) {
    const ok = await notifyRevalidate(["public"]);
    console.log(JSON.stringify({ revalidated: ok }));
  }
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.recommendations)
    .where(
      and(
        eq(schema.recommendations.status, "pending"),
        eq(schema.recommendations.origin, "llm"),
        lt(schema.recommendations.createdAt, sql`now() - interval '48 hours'`),
      ),
    );
  console.log(JSON.stringify({ stalePending: n }));
  if (n > 0) process.exitCode = 1;
}

async function evaluate(): Promise<void> {
  const file = process.argv[3] ?? "worker/eval/labelled.json";
  const labelled = JSON.parse(await readFile(file, "utf8")) as Labelled[];
  const channelId = process.env.EVAL_CHANNEL_ID ?? "UC2UWtuZR3kH-5C26HVMMB6A";
  const result = await runEval(labelled, {
    channelId,
    listUploads: (id) => listUploads(id),
    extract: extractor(),
  });
  console.log(`precision ${result.precision.toFixed(3)} recall ${result.recall.toFixed(3)}`);
  console.log(JSON.stringify(result.perVideo, null, 2));
  if (result.precision < 0.85) process.exitCode = 2;
}

const command = process.argv[2] ?? "ingest";
const run =
  command === "eval"
    ? evaluate
    : command === "geo"
      ? geo
      : command === "osm-areas"
        ? async () => {
            const result = await importOsmAreas(db, process.argv[3]);
            console.log(JSON.stringify({ osmAreas: result }));
            if (result.some((r) => r.error)) process.exitCode = 1;
            if (result.some((r) => r.areas)) await notifyRevalidate(["public"]);
          }
        : command === "review"
          ? review
          : command === "retry-unchecked"
            ? retry
            : command === "diet"
              ? diet
              : command === "areas"
                ? areas
                : ingest;

// Every command is recorded so /admin/ops shows the last runs and any failure.
recordRun(db, process.argv[2] ?? "ingest", async () => {
  await run();
  return { ok: true };
})
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
