import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../db";
import { requireAdminPage } from "../../../lib/auth";
import { openReports } from "../../../lib/reports-admin";
import { FLAG_MIN } from "../../../lib/trust";
import { resolveReportAction } from "../review/actions";

const OUTCOMES = [
  ["open", "Still open"],
  ["closed", "Mark closed"],
  ["moved", "Mark moved"],
] as const;

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading reports…</p>}>
      <ReportQueue />
    </Suspense>
  );
}

async function ReportQueue() {
  await requireAdminPage();
  // Snapshot the render time so choices below only resolve reports the admin could see.
  const seenThrough = new Date().toISOString();
  const groups = await openReports(db);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="text-muted">
        Visitor reports that are not resolved yet. Any choice sets the place status and today&apos;s
        last verified date, and resolves the reports listed here; reports that arrive after this
        page loaded stay open.
      </p>
      {groups.length === 0 ? (
        <p>No open reports.</p>
      ) : (
        groups.map(({ place, flagged, reports }) => (
          <article key={place.id} className="flex flex-col gap-3 border-b border-line pb-6">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold">
                <Link href={`/${place.citySlug}/place/${place.slug}`} className="underline">
                  {place.name}
                </Link>
              </h2>
              <span className="text-sm text-muted">Status: {place.status}</span>
              {flagged && (
                <span className="text-sm font-medium">Flagged: {FLAG_MIN}+ visitors</span>
              )}
            </header>
            <ul className="flex flex-col gap-1 text-sm">
              {reports.map((r, i) => (
                <li key={i}>
                  <span className="font-medium">{r.kind}</span>
                  {r.message && `: ${r.message}`}
                  <span className="text-muted"> ({r.createdAt.toISOString().slice(0, 10)})</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map(([outcome, label]) => (
                <form
                  key={outcome}
                  action={resolveReportAction.bind(null, place.id, outcome, seenThrough)}
                >
                  <button
                    type="submit"
                    className="min-h-11 rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {label}
                    <span className="sr-only"> for {place.name}</span>
                  </button>
                </form>
              ))}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
