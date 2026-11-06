import { db } from "../db";
import { extractPicks } from "../lib/llm/extract";
import { listUploads } from "../lib/youtube";
import { runIngest } from "../lib/worker/ingest";

async function main(): Promise<void> {
  const summary = await runIngest({
    db,
    listUploads,
    extract: extractPicks,
    now: () => new Date(),
  });
  console.log(JSON.stringify(summary));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
