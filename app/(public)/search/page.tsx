import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PickList } from "../../../components/PickList";
import { SearchBar } from "../../../components/SearchBar";
import { Skeleton } from "../../../components/Skeleton";
import { db } from "../../../db";
import { getPlaceCards } from "../../../lib/public/queries";
import { searchAll } from "../../../lib/public/search";

type Props = PageProps<"/search">;

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const link =
  "flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 font-semibold no-underline hover:underline";

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
  // Same rows as every list: lid code, Watch and Directions straight from search.
  const order = res.places.map((p) => p.slug);
  const placeCards = (await getPlaceCards(db, order)).sort(
    (a, b) => order.indexOf(a.placeSlug) - order.indexOf(b.placeSlug),
  );

  return (
    <>
      <h1 className="type-lid text-[2.2rem]">
        {query.trim() ? `Results for “${query}”` : "Search"}
      </h1>
      <SearchBar defaultValue={query} />

      {query.trim() === "" ? (
        <p className="text-muted">Type a dish, a place or a creator name.</p>
      ) : total === 0 ? (
        <p className="text-muted">Nothing found for “{query}”. Try a dish like chole bhature.</p>
      ) : (
        <>
          {res.dishes.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Dishes</h2>
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
              <h2 className="type-lid text-[1.75rem]">Places</h2>
              <PickList
                cards={placeCards}
                numbered={false}
                headingLevel={3}
                emptyText="No places match."
              />
            </section>
          )}
          {res.creators.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Creators</h2>
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
