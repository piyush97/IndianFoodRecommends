import { Suspense } from "react";
import { db } from "../../../db";
import { requireAdminPage } from "../../../lib/auth";
import { topMisses } from "../../../lib/search-misses";

export default function SearchesPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading searches…</p>}>
      <Misses />
    </Suspense>
  );
}

async function Misses() {
  await requireAdminPage();
  const rows = await topMisses(db);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Searches with no results</h1>
      <p className="text-muted">
        Last 30 days, most repeated first. Text only: no IP, no account. Each one is a dish, place
        or creator to add.
      </p>
      {rows.length === 0 ? (
        <p className="text-muted">No dead-end searches yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2">Search</th>
              <th className="py-2">Times</th>
              <th className="py-2">Last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.query} className="border-b border-line">
                <td className="py-2">{r.query}</td>
                <td className="py-2">{r.hits}</td>
                <td className="py-2">{r.lastAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
