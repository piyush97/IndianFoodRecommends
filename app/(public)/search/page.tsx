import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "../../../components/Skeleton";
import { db } from "../../../db";
import { searchAll } from "../../../lib/public/search";

type Props = PageProps<"/search">;

const link =
  "inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent";

export default function SearchPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: Pick<Props, "searchParams">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : "";
  const res = await searchAll(db, query);
  const total = res.dishes.length + res.places.length + res.creators.length;

  return (
    <>
      <form action="/search" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search dish, place or creator
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={100}
          placeholder="Dish, place or creator"
          className="min-h-11 flex-1 rounded-[var(--radius-step)] border border-line bg-paper px-3 focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          className="min-h-11 rounded-[var(--radius-step)] bg-accent px-4 font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Search
        </button>
      </form>

      {query.trim() === "" ? (
        <p className="text-muted">Type a dish, a place or a creator name.</p>
      ) : total === 0 ? (
        <p className="text-muted">Nothing found for “{query}”. Try a dish like chole bhature.</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Results for “{query}”</h1>
          {res.dishes.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">Dishes</h2>
              <ul>
                {res.dishes.map((d) => (
                  <li key={`${d.citySlug}-${d.slug}`}>
                    <Link href={`/${d.citySlug}/${d.slug}`} className={link}>
                      {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {res.places.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">Places</h2>
              <ul>
                {res.places.map((p) => (
                  <li key={`${p.citySlug}-${p.slug}`}>
                    <Link href={`/${p.citySlug}/place/${p.slug}`} className={link}>
                      {p.name}
                      {p.locality && <span className="text-sm text-muted">{p.locality}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {res.creators.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">Creators</h2>
              <ul>
                {res.creators.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/creator/${c.slug}`} className={link}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
