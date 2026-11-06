import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PickList } from "../../components/PickList";
import { Skeleton } from "../../components/Skeleton";
import { cachedCities, cachedHome } from "./data";

export default function Home() {
  return (
    <>
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Where Indian food vloggers say to eat
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

const chip =
  "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent";

async function HomeLists() {
  // Request time only: builds never need the database; the data stays cached for hours.
  await connection();
  const cities = await cachedCities();
  if (cities.length === 0) return <p className="text-muted">No picks yet.</p>;
  const homes = (await Promise.all(cities.map((c) => cachedHome(c.slug)))).filter(
    (h) => h !== null,
  );

  return (
    <>
      {homes.map((home) => (
        <section key={home.city.slug} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">
            <Link href={`/${home.city.slug}`} className="underline underline-offset-4">
              {home.city.name}
            </Link>
          </h2>
          <ul className="flex flex-wrap gap-2">
            {home.dishes.slice(0, 8).map((d) => (
              <li key={d.slug}>
                <Link href={`/${home.city.slug}/${d.slug}`} className={chip}>
                  {d.name}
                  <span className="text-sm text-muted">
                    {d.picks} {d.picks === 1 ? "pick" : "picks"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="text-lg font-semibold">Recently added in {home.city.name}</h3>
          <PickList
            cards={home.recent.slice(0, 4)}
            numbered={false}
            emptyText={`No picks yet for ${home.city.name}.`}
          />
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Creators</h2>
        <ul className="flex flex-col gap-1">
          {mergeCreators(homes).map((c) => (
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
    </>
  );
}

function mergeCreators(homes: { creators: { slug: string; name: string; picks: number }[] }[]) {
  const all = new Map<string, { slug: string; name: string; picks: number }>();
  for (const h of homes) {
    for (const c of h.creators) {
      const prev = all.get(c.slug);
      all.set(c.slug, { ...c, picks: (prev?.picks ?? 0) + c.picks });
    }
  }
  return [...all.values()].sort((a, b) => b.picks - a.picks || a.name.localeCompare(b.name));
}
