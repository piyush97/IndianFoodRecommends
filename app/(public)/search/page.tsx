import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { DietFilter } from "../../../components/DietFilter";
import { FilterGroup, Segment } from "../../../components/FilterGroup";
import { PickList } from "../../../components/PickList";
import { nearAreaSearch } from "../../../lib/public/spatial";
import { Skeleton } from "../../../components/Skeleton";
import { db } from "../../../db";
import { parseDiet, type DietFilter as Diet } from "../../../lib/diet";
import { CITIES } from "../../../lib/cities";
import { getDishPicks, getPlaceCards, type PickCard } from "../../../lib/public/queries";
import { searchAll } from "../../../lib/public/search";
import { clientKey, takeToken } from "../../../lib/rate-limit";
import { withSpan } from "../../../lib/tracing";
import { headers } from "next/headers";
import { logMiss } from "../../../lib/search-misses";
import { cachedCities, cachedHome } from "../data";

type Props = PageProps<"/search">;
type Sort = "creators" | "newest";

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

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

type Filters = { q: string; city: string; dish: string; sort: Sort; diet?: Diet };

function searchHref({ q, city, dish, sort, diet }: Filters) {
  const params = new URLSearchParams({ q });
  if (city) params.set("city", city);
  if (dish) params.set("dish", dish);
  if (diet) params.set("diet", diet);
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
  const diet = parseDiet(one(params.diet));

  if (!query.trim()) return <EmptyQuery />;

  const nearby = await nearAreaSearch(db, query, city || undefined, diet);
  if (nearby)
    return (
      <>
        <h1 className="type-lid text-[2.2rem]">Results for “{query}”</h1>
        {nearby.area ? (
          <p className="text-sm text-muted">
            Within 2 km of{" "}
            <Link href={`/${nearby.area.citySlug}/area/${nearby.area.slug}`} className="underline">
              {nearby.area.name}, {nearby.area.cityName}
            </Link>
            . Nearest first. Distances are straight-line; approximate pins remain labelled.
          </p>
        ) : (
          <p role="status">{nearby.error}</p>
        )}
        <DietFilter
          current={diet}
          href={(d) => searchHref({ q: query, city, dish: "", sort, diet: d })}
        />
        {nearby.suggestions.length > 0 && (
          <nav aria-label="Area suggestions" className="flex flex-wrap gap-2">
            {nearby.suggestions.map((s) => (
              <Link
                key={`${s.city}/${s.label}`}
                className="btn btn-line"
                href={searchHref({
                  q: `${nearby.dish} near ${s.label}`,
                  city: s.city,
                  dish: "",
                  sort,
                  diet,
                })}
              >
                {s.label} ({s.city})
              </Link>
            ))}
          </nav>
        )}
        <PickList
          cards={nearby.cards}
          headingLevel={2}
          emptyText="No matching picks within this area. Try another dish or neighbourhood."
        />
      </>
    );

  // Search is the heaviest read path; cap it per client in Postgres.
  const limit = await takeToken(db, clientKey({ headers: await headers() }, "search"), {
    capacity: 30,
    refillPerSecond: 30 / 60,
  });
  if (!limit.ok) {
    return (
      <p className="border-y border-line py-6 text-muted" role="status">
        Too many searches from this connection. Try again in {Math.ceil(limit.retryAfterMs / 1000)}{" "}
        seconds.
      </p>
    );
  }

  const res = await withSpan("db.search", () => searchAll(db, query), {
    "search.length": query.length,
  });
  const dishes = [...new Map(res.dishes.map((d) => [d.slug, d.name]))].map(([slug, name]) => ({
    slug,
    name,
  }));
  const dishSlugs = dishes.map((d) => d.slug);
  const dish = dishSlugs.includes(one(params.dish)) ? one(params.dish) : "";
  const f: Filters = { q: query, city, dish, sort, diet };
  const [allDishCards, allPlaceCards] = await Promise.all([
    getDishPicks(db, dishSlugs, undefined, diet),
    getPlaceCards(
      db,
      res.places.map((p) => p.slug),
      undefined,
      diet,
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
  // A diet filter can empty the list without the query being a miss.
  if (!diet && total === 0 && res.creators.length === 0) after(() => logMiss(db, query));

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
  // With a diet filter, hide dishes of the other diet (0 picks) unless already selected.
  const dishOptions = dishes.filter((d) => !diet || perDish.get(d.slug)! > 0 || d.slug === dish);
  const dishCards = sortCards(
    allDishCards.filter((c) => inCity(c) && inDish(c)),
    sort,
  );
  const placeCards = placeOnly.filter(inCity);
  const cityName = CITIES.find((c) => c.slug === city)?.name;
  // Full pages (map, every creator) for each matched dish in each city that has picks.
  const dishLinks = dishes
    .filter((d) => !dish || d.slug === dish)
    .flatMap((d) =>
      CITIES.filter(
        (c) =>
          (!city || c.slug === city) &&
          allDishCards.some((card) => card.citySlug === c.slug && card.dishes.includes(d.name)),
      ).map((c) => ({ href: `/${c.slug}/${d.slug}`, label: `${d.name} in ${c.name}` })),
    );

  return (
    <>
      <h1 className="type-lid text-[2.2rem]">Results for “{query}”</h1>

      {!diet && total === 0 && res.creators.length === 0 ? (
        <p className="border-y border-line py-6 text-muted" role="status">
          Nothing found for “{query}”. Check the spelling, or try a dish like{" "}
          <Link href="/search?q=chole+bhature" className="font-semibold text-ink underline">
            chole bhature
          </Link>
          .
        </p>
      ) : (
        <>
          {(total > 0 || diet) && (
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
              <DietFilter current={diet} href={(d) => searchHref({ ...f, diet: d })} />
              {dishOptions.length > 1 && (
                <FilterGroup label="Dish">
                  <Segment href={searchHref({ ...f, dish: "" })} active={!dish}>
                    All
                  </Segment>
                  {dishOptions.map((d) => (
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

          {diet && total === 0 && (
            <p className="border-y border-line py-6 text-muted" role="status">
              No {diet} picks for “{query}”.{" "}
              <Link
                href={searchHref({ ...f, diet: undefined })}
                className="font-semibold text-ink underline"
              >
                Show all
              </Link>
            </p>
          )}
          {dishes.length > 0 && !(diet && total === 0) && (
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
              {dishLinks.length > 0 && (
                <nav aria-label="Dish pages" className="flex flex-wrap gap-2 py-1">
                  {dishLinks.map((l) => (
                    <Link key={l.href} href={l.href} className="btn btn-line">
                      {l.label}
                    </Link>
                  ))}
                </nav>
              )}
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

function Count({ n }: { n: number }) {
  return <span className="font-normal tabular-nums opacity-80">{n}</span>;
}
