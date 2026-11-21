import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../../../db";
import { requireAdminPage } from "../../../lib/auth";
import type { Evidence } from "../../../lib/worker/discover-creators";
import { approveCandidateFormAction, rejectCandidateFormAction } from "../review/actions";

export default function CreatorsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading creator candidates…</p>}>
      <CandidateList />
    </Suspense>
  );
}

const button =
  "min-h-11 rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent";

async function CandidateList() {
  await requireAdminPage();
  const rows = await db
    .select()
    .from(schema.creatorCandidates)
    .where(eq(schema.creatorCandidates.status, "pending"))
    .orderBy(desc(schema.creatorCandidates.score))
    .limit(100);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Creator candidates</h1>
      <p className="text-muted">
        Channels found by <code>pnpm worker discover-creators</code>. Approve adds the channel as a
        creator; the next ingest reads its feed.
      </p>
      {rows.length === 0 ? (
        <p>No pending candidates.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => {
            const e = r.evidence as Evidence;
            return (
              <li key={r.id} className="flex flex-col gap-2 border-b border-line pb-4">
                <p>
                  <a
                    href={`https://www.youtube.com/channel/${r.ytChannelId}`}
                    className="font-medium underline"
                  >
                    {r.name}
                  </a>{" "}
                  <span className="text-muted">
                    {r.citySlug} · score {r.score} · {e.subscribers ?? "?"} subscribers · last
                    upload {e.newestUpload ?? "unknown"}
                  </span>
                </p>
                <p className="text-sm">
                  Known places mentioned ({e.mentions.length}):{" "}
                  {e.mentions.length ? e.mentions.join(", ") : "none"}
                </p>
                <p className="text-muted text-sm">Found by: {e.queries.join("; ")}</p>
                <div className="flex gap-3">
                  <form action={approveCandidateFormAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={button}>
                      Approve {r.name}
                    </button>
                  </form>
                  <form action={rejectCandidateFormAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={button}>
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
