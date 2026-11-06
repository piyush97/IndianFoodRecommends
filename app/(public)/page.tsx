import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PickList } from "../../components/PickList";
import { Skeleton } from "../../components/Skeleton";
import { cachedHome } from "./data";

export default function Home() {
  return (
    <>
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Where Delhi food vloggers say to eat
        </h1>
        <form action="/search" className="flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Search dish, place or creator
          </label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Dish, place or creator"
            maxLength={100}
            className="min-h-11 flex-1 rounded-[var(--radius-step)] border border-line bg-paper px-3 focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="submit"
            className="min-h-11 rounded-[var(--radius-step)] bg-accent px-4 font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Search
          </button>
        </form>
      </section>
      <Suspense fallback={<Skeleton />}>
        <HomeLists />
      </Suspense>
    </>
  );
}

async function HomeLists() {
  // Read at request time so builds never need the database; the data itself
  // stays cached for hours via `use cache` in cachedHome.
  await connection();
  const home = await cachedHome("delhi");
  if (!home) return <p className="text-muted">No picks yet for Delhi.</p>;

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Popular in Delhi</h2>
        {home.dishes.length === 0 ? (
          <p className="text-muted">No picks yet for Delhi.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {home.dishes.slice(0, 8).map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/delhi/${d.slug}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {d.name}
                  <span className="text-sm text-muted">
                    {d.picks} {d.picks === 1 ? "pick" : "picks"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Creators</h2>
        <ul className="flex flex-col gap-1">
          {home.creators.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/creator/${c.slug}`}
                className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {c.name}
                <span className="text-sm text-muted">
                  {c.picks} {c.picks === 1 ? "pick" : "picks"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Recently added</h2>
        <PickList
          cards={home.recent}
          citySlug="delhi"
          numbered={false}
          emptyText="No picks yet for Delhi."
        />
      </section>
    </>
  );
}
