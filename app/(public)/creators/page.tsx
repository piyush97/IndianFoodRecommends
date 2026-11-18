import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CreatorAvatar } from "../../../components/CreatorAvatar";
import { Skeleton } from "../../../components/Skeleton";
import { cachedCreators } from "../data";

export const metadata: Metadata = {
  title: "Creators",
};

export default function CreatorsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Creators />
    </Suspense>
  );
}

async function Creators() {
  // Request time only: builds never need the database; the list stays cached for hours.
  await connection();
  const creators = await cachedCreators();

  return (
    <>
      <h1 className="type-lid text-[2.6rem] sm:text-[3.2rem]">Creators</h1>
      {creators.length === 0 ? (
        <p className="text-muted">No creators yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((creator) => (
            <li key={creator.slug}>
              <Link
                href={`/creator/${creator.slug}`}
                className="flex min-h-11 items-center gap-3 rounded-[var(--radius-step)] border border-line p-2 font-semibold no-underline hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <CreatorAvatar name={creator.name} avatarUrl={creator.avatarUrl} size={48} />
                <span className="min-w-0 flex-1">{creator.name}</span>
                <span className="text-sm font-normal text-muted tabular-nums">
                  {creator.picks} {creator.picks === 1 ? "pick" : "picks"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
