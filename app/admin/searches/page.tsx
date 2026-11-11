import { Suspense } from "react";
import { db, schema } from "../../../db";
import { requireAdminPage } from "../../../lib/auth";
import { aliasMissAction } from "../review/actions";
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
  const [rows, dishes] = await Promise.all([
    topMisses(db),
    db.select({ slug: schema.dishes.slug, name: schema.dishes.name }).from(schema.dishes),
  ]);
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2">Search</th>
                <th className="py-2">Times</th>
                <th className="py-2">Last</th>
                <th className="py-2">Same as dish</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.query} className="border-b border-line">
                  <td className="py-2">{r.query}</td>
                  <td className="py-2">{r.hits}</td>
                  <td className="py-2">{r.lastAt.toISOString().slice(0, 10)}</td>
                  <td className="py-2">
                    <form action={aliasMissAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="query" value={r.query} />
                      <label>
                        <span className="sr-only">Dish slug for {r.query}</span>
                        <input
                          name="dishSlug"
                          list="dishes"
                          required
                          pattern="\S+"
                          maxLength={80}
                          placeholder="dish slug"
                          className="min-h-11 w-full max-w-48 rounded-[var(--radius-step)] border border-line bg-paper px-3 text-base focus-visible:outline-2 focus-visible:outline-accent"
                        />
                      </label>
                      <button
                        type="submit"
                        className="min-h-11 rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Add alias<span className="sr-only"> for {r.query}</span>
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <datalist id="dishes">
        {dishes.map((d) => (
          <option key={d.slug} value={d.slug}>
            {d.name}
          </option>
        ))}
      </datalist>
    </section>
  );
}
