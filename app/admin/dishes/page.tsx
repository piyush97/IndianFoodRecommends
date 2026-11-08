import { Suspense } from "react";
import { db } from "../../../db";
import { requireAdminPage } from "../../../lib/auth";
import { dishDuplicates } from "../../../lib/dish-dupes";
import { mergeDishAction } from "../review/actions";

export default function DishesPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading dishes…</p>}>
      <Dupes />
    </Suspense>
  );
}

async function Dupes() {
  await requireAdminPage();
  const dupes = await dishDuplicates(db);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Duplicate dishes</h1>
      <p className="text-muted">
        A dish that is another dish plus a word like desi, ghee or famous. Merging moves its picks
        and keeps its name as an alias. New picks are named this way automatically, so the list only
        shrinks.
      </p>
      {dupes.length === 0 ? (
        <p className="text-muted">No duplicates found.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {dupes.map(({ from, into }) => (
            <li key={from.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <strong>{from.name}</strong> ({from.picks} {from.picks === 1 ? "pick" : "picks"})
                into <strong>{into.name}</strong> ({into.picks})
              </span>
              <form action={mergeDishAction.bind(null, from.id, into.id)}>
                <button type="submit" className="btn btn-line">
                  Merge into {into.name}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
