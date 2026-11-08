import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ROUTE } from "../../components/LidCode";
import { DishRow } from "../../components/DishRow";
import { PickList } from "../../components/PickList";
import { SearchBar } from "../../components/SearchBar";
import { Skeleton } from "../../components/Skeleton";
import { cachedCities, cachedHome } from "./data";

export default function Home() {
  return (
    <>
      <section className="flex flex-col gap-4">
        <h1 className="type-lid text-[2.75rem] sm:text-[3.6rem]">Where food vloggers say to eat</h1>
        <p className="max-w-prose text-muted">
          Ranked by how many creators picked each place, with the video moment.
        </p>
        <SearchBar />
      </section>
      <Suspense fallback={<Skeleton />}>
        <HomeLists />
      </Suspense>
    </>
  );
}

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
          <div className="flex items-end justify-between gap-3">
            <h2 className="type-lid text-[2rem]">
              <Link href={`/${home.city.slug}`} className="no-underline hover:underline">
                {home.city.name}
              </Link>
            </h2>
            <p
              className="text-sm font-bold"
              style={{
                color:
                  home.city.slug === "kolkata" ? "var(--color-ink)" : ROUTE[home.city.slug]?.bg,
              }}
            >
              {home.dishes.reduce((n, d) => n + d.picks, 0)} picks
            </p>
          </div>
          <PickList
            cards={home.top.slice(0, 3)}
            headingLevel={3}
            emptyText={`No picks yet for ${home.city.name}.`}
          />
          <DishRow
            citySlug={home.city.slug}
            cityName={home.city.name}
            dishes={home.dishes}
            limit={10}
            showAll
          />
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[2rem]">Creators</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2">
          {mergeCreators(homes).map((c) => (
            <li key={c.slug} className="border-b border-line">
              <Link
                href={`/creator/${c.slug}`}
                className="flex min-h-12 items-center justify-between gap-3 py-2 pr-2 font-semibold no-underline hover:underline"
              >
                {c.name}
                <span className="text-sm font-normal text-muted tabular-nums">
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
