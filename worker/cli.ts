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
import { getUpload, listArchive, listUploadsWithFallback as listUploads } from "../lib/youtube";
import { runIngest } from "../lib/worker/ingest";
import { runEval, type Labelled } from "../lib/worker/eval";
import { notifyRevalidate } from "../lib/revalidate-client";
import { importOsmAreas } from "../lib/worker/osm-areas";
import { importOsmHours } from "../lib/worker/osm-hours";
import { refreshHeatmap, refreshWalks } from "../lib/worker/geo";
import { recordRun } from "../lib/worker/run-log";
import { retryUnchecked } from "../lib/worker/retry-unchecked";
import { dedupePlaces } from "../lib/worker/dedupe-places";
import { pruneRateLimits } from "../lib/rate-limit";

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
  // An ingest that errored and ingested nothing should fire the alert; one bad video among successes should not.
  if (summary.errors > 0 && summary.videos === 0) process.exitCode = 1;
  await review();
  // Labelling is a nicety: a failure must not fail the ingest or fire the alert.
  await diet().catch((error) => console.error("diet:", error));
  await areas().catch((error) => console.error("areas:", error));
  await geo().catch((error) => console.error("geo:", error));
  await osmHours().catch((error) => console.error("osm-hours:", error));
  await pruneRateLimits(db).catch((error) => console.error("prune rate limits:", error));
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
  getUpload,
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

/** Lists places that are one shop under two names; `--apply` merges them. */
async function dedupe(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const groups = await dedupePlaces(db, { apply });
  for (const { keep, merge } of groups) {
    const show = (p: typeof keep) => `${p.name} [${p.locality ?? "-"}] #${p.id} (${p.picks})`;
    console.log(`keep ${show(keep)} <- ${merge.map(show).join(", ")}`);
  }
  const merged = groups.reduce((n, g) => n + g.merge.length, 0);
  console.log(JSON.stringify({ dedupePlaces: { groups: groups.length, merged, applied: apply } }));
  if (apply && merged > 0)
    console.log(JSON.stringify({ revalidated: await notifyRevalidate(["public"]) }));
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

/** Imports the OSM area list; a per-area error fails the run. */
async function osmAreas(): Promise<void> {
  const result = await importOsmAreas(db, process.argv[3]);
  console.log(JSON.stringify({ osmAreas: result }));
  if (result.some((r) => r.error)) process.exitCode = 1;
  if (result.some((r) => r.areas)) await notifyRevalidate(["public"]);
}

/** Imports opening hours from OSM. As its own command a per-city error fails the run; inside ingest it is only logged. */
async function osmHours(): Promise<void> {
  const alone = process.argv[2] === "osm-hours";
  const result = await importOsmHours(db, alone ? process.argv[3] : undefined);
  console.log(JSON.stringify({ osmHours: result }));
  if (alone && result.some((r) => r.error)) process.exitCode = 1;
  if (result.some((r) => r.changed)) await notifyRevalidate(["public"]);
}

const commands: Record<string, () => Promise<void>> = {
  ingest,
  eval: evaluate,
  geo,
  review,
  "retry-unchecked": retry,
  diet,
  areas,
  "dedupe-places": dedupe,
  "osm-areas": osmAreas,
  "osm-hours": osmHours,
};

const command = process.argv[2] ?? "ingest";
const run = commands[command];
// Unknown commands must fail before any DB work: a typo used to run a full ingest.
if (!run) {
  console.error(
    `unknown worker command "${command}"; expected one of: ${Object.keys(commands).join(", ")}`,
  );
  process.exit(2);
}

// Every command is recorded so /admin/ops shows the last runs and any failure.
recordRun(db, command, async () => {
  await run();
  // A command that set a failing exit code is a failed run, so /admin/ops and the alert agree.
  if (process.exitCode) throw new Error(`${command} exited with code ${process.exitCode}`);
  return { ok: true };
})
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
