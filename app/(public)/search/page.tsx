import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PickList } from "../../../components/PickList";
import { Skeleton } from "../../../components/Skeleton";
import { db } from "../../../db";
import { CITIES } from "../../../lib/cities";
import { getDishPicks, getPlaceCards, type PickCard } from "../../../lib/public/queries";
import { searchAll } from "../../../lib/public/search";
import { cachedCities, cachedHome } from "../data";

type Props = PageProps<"/search">;
type Sort = "creators" | "newest";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const link =
  "flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 font-semibold no-underline hover:underline";
const segment =
  "inline-flex min-h-11 items-center gap-1.5 px-2.5 text-sm font-bold whitespace-nowrap uppercase tracking-wide no-underline focus-visible:outline-offset-[-3px]";

export default function SearchPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

type Filters = { q: string; city: string; dish: string; sort: Sort };

function searchHref({ q, city, dish, sort }: Filters) {
  const params = new URLSearchParams({ q });
  if (city) params.set("city", city);
  if (dish) params.set("dish", dish);
  if (sort !== "creators") params.set("sort", sort);
  return `/search?${params}`;
}

function sortCards(cards: PickCard[], sort: Sort) {
  if (sort === "creators") return cards; // already ranked by distinct creators
  return [...cards].sort((a, b) => b.pickedOn.localeCompare(a.pickedOn) || b.score - a.score);
}

async function Results({ searchParams }: Pick<Props, "searchParams">) {
  const params = await searchParams;
  const query = one(params.q).slice(0, 100);
  const city = CITIES.some((c) => c.slug === one(params.city)) ? one(params.city) : "";
  const sort: Sort = one(params.sort) === "newest" ? "newest" : "creators";

  if (!query.trim()) return <EmptyQuery />;

  const res = await searchAll(db, query);
  const dishes = [...new Map(res.dishes.map((d) => [d.slug, d.name]))].map(([slug, name]) => ({
    slug,
    name,
  }));
  const dishSlugs = dishes.map((d) => d.slug);
  const dish = dishSlugs.includes(one(params.dish)) ? one(params.dish) : "";
  const f: Filters = { q: query, city, dish, sort };
  const [allDishCards, allPlaceCards] = await Promise.all([
    getDishPicks(db, dishSlugs),
    getPlaceCards(
      db,
      res.places.map((p) => p.slug),
    ),
  ]);

  // Name matches keep search order; drop places the dish list already shows.
  const inDishList = new Set(allDishCards.map((c) => c.placeSlug));
  const order = res.places.map((p) => p.slug);
  const placeOnly = allPlaceCards
    .filter((c) => !inDishList.has(c.placeSlug))
    .sort((a, b) => order.indexOf(a.placeSlug) - order.indexOf(b.placeSlug));

  const perCity = new Map<string, number>();
  for (const c of [...allDishCards, ...placeOnly])
    perCity.set(c.citySlug, (perCity.get(c.citySlug) ?? 0) + 1);
  const total = allDishCards.length + placeOnly.length;

  const inCity = (c: PickCard) => !city || c.citySlug === city;
  const dishName = dishes.find((d) => d.slug === dish)?.name;
  // Cards list their dish names, so a dish filter keeps places picked for that dish.
  const inDish = (c: PickCard) => !dishName || c.dishes.includes(dishName);
  const perDish = new Map(
    dishes.map((d) => [
      d.slug,
      allDishCards.filter((c) => inCity(c) && c.dishes.includes(d.name)).length,
    ]),
  );
  const dishCards = sortCards(
    allDishCards.filter((c) => inCity(c) && inDish(c)),
    sort,
  );
  const placeCards = placeOnly.filter(inCity);
  const cityName = CITIES.find((c) => c.slug === city)?.name;

  return (
    <>
      <h1 className="type-lid text-[2.2rem]">Results for “{query}”</h1>

      {total === 0 && res.creators.length === 0 ? (
        <p className="border-y border-line py-6 text-muted" role="status">
          Nothing found for “{query}”. Check the spelling, or try a dish like{" "}
          <Link href="/search?q=chole+bhature" className="font-semibold text-ink underline">
            chole bhature
          </Link>
          .
        </p>
      ) : (
        <>
          {total > 0 && (
            <div className="flex flex-col gap-3">
              <FilterGroup label="City">
                <Segment href={searchHref({ ...f, city: "" })} active={!city}>
                  All <Count n={total} />
                </Segment>
                {CITIES.filter((c) => perCity.has(c.slug)).map((c) => (
                  <Segment
                    key={c.slug}
                    href={searchHref({ ...f, city: c.slug })}
                    active={city === c.slug}
                  >
                    {c.name} <Count n={perCity.get(c.slug)!} />
                  </Segment>
                ))}
              </FilterGroup>
              {dishes.length > 1 && (
                <FilterGroup label="Dish">
                  <Segment href={searchHref({ ...f, dish: "" })} active={!dish}>
                    All
                  </Segment>
                  {dishes.map((d) => (
                    <Segment
                      key={d.slug}
                      href={searchHref({ ...f, dish: d.slug })}
                      active={dish === d.slug}
                    >
                      {d.name} <Count n={perDish.get(d.slug)!} />
                    </Segment>
                  ))}
                </FilterGroup>
              )}
              {allDishCards.length > 1 && (
                <FilterGroup label="Sort">
                  <Segment
                    href={searchHref({ ...f, sort: "creators" })}
                    active={sort === "creators"}
                  >
                    Most creators
                  </Segment>
                  <Segment href={searchHref({ ...f, sort: "newest" })} active={sort === "newest"}>
                    Newest
                  </Segment>
                </FilterGroup>
              )}
            </div>
          )}

          {dishes.length > 0 && (
            <section className="flex flex-col gap-2">
              <div>
                <h2 className="type-lid text-[1.75rem]">
                  {dishName ?? (dishes.length === 1 ? dishes[0].name : "Matching dishes")}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {sort === "creators"
                    ? "Places that more creators picked come first."
                    : "Most recently picked first."}
                </p>
              </div>
              <PickList
                cards={dishCards}
                headingLevel={3}
                emptyText={`No picks for this dish in ${cityName ?? "any city"} yet.`}
              />
            </section>
          )}

          {placeCards.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="type-lid text-[1.75rem]">Places</h2>
              <PickList cards={placeCards} numbered={false} headingLevel={3} emptyText="" />
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

/** No query yet: offer the most picked dishes as one-tap searches. */
async function EmptyQuery() {
  const homes = await Promise.all((await cachedCities()).map((c) => cachedHome(c.slug)));
  const picks = new Map<string, { name: string; picks: number }>();
  for (const h of homes)
    for (const d of h?.dishes ?? [])
      picks.set(d.name, { name: d.name, picks: (picks.get(d.name)?.picks ?? 0) + d.picks });
  const top = [...picks.values()].sort((a, b) => b.picks - a.picks).slice(0, 12);

  return (
    <>
      <h1 className="type-lid text-[2.2rem]">Search</h1>
      <p className="text-muted">Type a dish, a place or a creator in the search box above.</p>
      {top.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Most picked dishes</h2>
          <ul>
            {top.map((d) => (
              <li key={d.name}>
                <Link href={`/search?q=${encodeURIComponent(d.name)}`} className={link}>
                  {d.name}
                  <span className="text-sm font-normal text-muted tabular-nums">
                    {d.picks} {d.picks === 1 ? "pick" : "picks"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted" aria-hidden="true">
        {label}
      </span>
      <nav
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="-mx-4 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0"
      >
        <ul className="inline-flex rounded-[var(--radius-step)] shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
          {children}
        </ul>
      </nav>
    </div>
  );
}

function Segment({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex">
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        scroll={false}
        className={`${segment} ${active ? "bg-ink text-paper" : "text-ink hover:bg-cloth"}`}
      >
        {children}
      </Link>
    </li>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-normal tabular-nums opacity-80">{n}</span>;
}
