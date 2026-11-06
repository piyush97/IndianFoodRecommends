import { readFile } from "node:fs/promises";
import { db } from "../db";
import { extractPicks } from "../lib/llm/extract";
import { listUploads } from "../lib/youtube";
import { runIngest } from "../lib/worker/ingest";
import { runEval, type Labelled } from "../lib/worker/eval";

async function ingest(): Promise<void> {
  const summary = await runIngest({ db, listUploads, extract: extractPicks, now: () => new Date() });
  console.log(JSON.stringify(summary));
}

async function evaluate(): Promise<void> {
  const file = process.argv[3] ?? "worker/eval/labelled.json";
  const labelled = JSON.parse(await readFile(file, "utf8")) as Labelled[];
  const channelId = process.env.EVAL_CHANNEL_ID ?? "UC2UWtuZR3kH-5C26HVMMB6A";
  const result = await runEval(labelled, {
    channelId,
    listUploads: (id) => listUploads(id),
    extract: extractPicks,
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
