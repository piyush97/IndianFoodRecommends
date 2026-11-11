import { Suspense } from "react";
import { db } from "../../../db";
import { requireAdminPage } from "../../../lib/auth";
import { placeDuplicates, type PlaceRef } from "../../../lib/place-dupes";
import { mergeAction } from "../review/actions";

export default function PlacesPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading places…</p>}>
      <Dupes />
    </Suspense>
  );
}

// Two places with the very same name are told apart by id, in the row and on the button.
function title(place: PlaceRef, other: PlaceRef): string {
  return place.name === other.name ? `${place.name} #${place.id}` : place.name;
}

async function Dupes() {
  await requireAdminPage();
  const dupes = await placeDuplicates(db);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Duplicate places</h1>
      <p className="text-muted">
        Places in the same city with nearly the same name. Some are one shop stored twice, others
        are separate branches, so check the locality first. Each button keeps the place it names,
        moves the other place&apos;s picks to it and deletes the other. Merging cannot be undone.
      </p>
      {dupes.length === 0 ? (
        <p className="text-muted">No likely duplicates found.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {dupes.map(({ a, b }) => (
            <li key={`${a.id}-${b.id}`} className="flex flex-col gap-3 py-3">
              {(
                [
                  [a, b],
                  [b, a],
                ] as const
              ).map(([keep, drop]) => (
                <div key={keep.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <strong>{title(keep, drop)}</strong>, {keep.locality ?? "no locality"} (
                    {keep.picks} {keep.picks === 1 ? "pick" : "picks"})
                  </span>
                  <form action={mergeAction.bind(null, drop.id, keep.id)}>
                    <button type="submit" className="btn btn-line">
                      Keep {title(keep, drop)}
                    </button>
                  </form>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
