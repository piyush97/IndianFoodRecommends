import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../db";
import { requireAdminPage } from "../../../lib/auth";
import { stalePlaces } from "../../../lib/stale";

export default function StalePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading stale places…</p>}>
      <StaleList />
    </Suspense>
  );
}

async function StaleList() {
  await requireAdminPage();
  const rows = await stalePlaces(db);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Stale places</h1>
      <p className="text-muted">
        Public places not verified in the last 12 months. Check each one is still open, then approve
        a fresh pick or report it closed.
      </p>
      {rows.length === 0 ? (
        <p>Nothing stale.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2">Place</th>
              <th className="py-2">City</th>
              <th className="py-2">Last verified</th>
              <th className="py-2">Picks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.citySlug}-${r.slug}`} className="border-b border-line">
                <td className="py-2">
                  <Link href={`/${r.citySlug}/place/${r.slug}`} className="underline">
                    {r.name}
                  </Link>
                </td>
                <td className="py-2">{r.citySlug}</td>
                <td className="py-2">{r.lastVerified ?? "never"}</td>
                <td className="py-2">{r.picks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
