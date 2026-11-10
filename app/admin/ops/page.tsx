import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { db, schema } from "../../../db";

export const metadata: Metadata = { title: "Ops", robots: { index: false, follow: false } };

const RUNS = 30;

export default function OpsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-lid text-[2.2rem]">Ops</h1>
      <Suspense fallback={<p className="text-muted">Loading runs…</p>}>
        <Runs />
      </Suspense>
    </div>
  );
}

async function Runs() {
  await connection();
  const runs = await db
    .select()
    .from(schema.workerRuns)
    .orderBy(desc(schema.workerRuns.startedAt))
    .limit(RUNS);

  const [counts] = await db
    .select({
      failed: sql<number>`count(*) filter (where ${schema.workerRuns.status} = 'failed')`.mapWith(
        Number,
      ),
      running: sql<number>`count(*) filter (where ${schema.workerRuns.status} = 'running')`.mapWith(
        Number,
      ),
    })
    .from(schema.workerRuns);

  const stale = await db
    .select({ id: schema.workerRuns.id })
    .from(schema.workerRuns)
    .where(eq(schema.workerRuns.status, "running"))
    .limit(1);

  return (
    <>
      <p className="text-muted">
        {runs.length === 0
          ? "No worker runs recorded yet."
          : `${counts.failed} failed and ${counts.running} running in the last ${runs.length} runs.`}
        {stale.length > 0 && (
          <span className="text-ink">
            {" "}
            A run is still marked running; it is closed as failed after two hours.
          </span>
        )}
      </p>
      {runs.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">The last {RUNS} worker runs</caption>
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th scope="col" className="py-2 pr-3 font-bold">
                Started
              </th>
              <th scope="col" className="py-2 pr-3 font-bold">
                Command
              </th>
              <th scope="col" className="py-2 pr-3 font-bold">
                Status
              </th>
              <th scope="col" className="py-2 font-bold">
                Took
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const seconds = run.finishedAt
                ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
                : null;
              return (
                <tr key={run.id} className="border-b border-line align-top">
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                    {run.startedAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="py-2 pr-3 font-semibold">{run.command}</td>
                  <td className="py-2 pr-3">
                    <span>{run.status}</span>
                    {run.error && (
                      <span className="block text-muted">{run.error.slice(0, 90)}</span>
                    )}
                  </td>
                  <td className="py-2 tabular-nums">
                    {seconds === null
                      ? "—"
                      : seconds < 90
                        ? `${seconds}s`
                        : `${Math.round(seconds / 60)}m`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
