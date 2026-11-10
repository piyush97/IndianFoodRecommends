import { and, eq, lt } from "drizzle-orm";
import { schema, type Db } from "../../db";

/** A run still marked running after this long is treated as crashed. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * Records one worker command in `worker_runs`: started, then ok or failed with
 * the summary. Stale `running` rows are closed first, because a killed process
 * cannot update its own row and would otherwise look alive forever.
 */
export async function recordRun<T extends Record<string, unknown>>(
  db: Db,
  command: string,
  fn: () => Promise<T>,
): Promise<T> {
  await db
    .update(schema.workerRuns)
    .set({ status: "failed", error: "stale: never finished", finishedAt: new Date() })
    .where(
      and(
        eq(schema.workerRuns.status, "running"),
        lt(schema.workerRuns.startedAt, new Date(Date.now() - STALE_AFTER_MS)),
      ),
    );

  const [run] = await db.insert(schema.workerRuns).values({ command }).returning();
  try {
    const summary = await fn();
    await db
      .update(schema.workerRuns)
      .set({ status: "ok", summary, finishedAt: new Date() })
      .where(eq(schema.workerRuns.id, run.id));
    return summary;
  } catch (error) {
    await db
      .update(schema.workerRuns)
      .set({ status: "failed", error: String(error).slice(0, 500), finishedAt: new Date() })
      .where(eq(schema.workerRuns.id, run.id));
    throw error;
  }
}
