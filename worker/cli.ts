import { readFile } from "node:fs/promises";
import { db } from "../db";
import { autoReviewPending, checkPick, geocodeIndia } from "../lib/auto-review";
import { classifyVideo, gatedExtract } from "../lib/jev";
import { extractPicks } from "../lib/llm/extract";
import { listUploads } from "../lib/youtube";
import { runIngest } from "../lib/worker/ingest";
import { runEval, type Labelled } from "../lib/worker/eval";
import { notifyRevalidate } from "../lib/revalidate-client";

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

  // No human queue: Jev verifies each pick and code approves or rejects it.
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.log("auto-review: TYPESAFE_API_KEY unset, picks stay pending");
    return;
  }
  const review = await autoReviewPending({
    db,
    listUploads: (channelId) => listUploads(channelId),
    check: (video, pick) => checkPick(video, pick, { apiKey }),
    geocode: geocodeIndia,
  });
  console.log(JSON.stringify({ autoReview: review }));
  if (review.approved > 0) {
    const ok = await notifyRevalidate(["public"]);
    console.log(JSON.stringify({ revalidated: ok }));
  }
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
const run = command === "eval" ? evaluate : ingest;

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
