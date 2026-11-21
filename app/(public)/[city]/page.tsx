import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DishRow } from "../../../components/DishRow";
import { ListMapToggle } from "../../../components/ListMapToggle";
import { mapPoints } from "../../../components/map-points";
import { DietFilter } from "../../../components/DietFilter";
import { PageHead } from "../../../components/PageHead";
import { NearMeList } from "../../../components/NearMeList";
import { Skeleton } from "../../../components/Skeleton";
import { CITIES } from "../../../lib/cities";
import { parseDiet } from "../../../lib/diet";
import { cachedCity, cachedAreas } from "../data";

export async function generateMetadata({ params }: PageProps<"/[city]">): Promise<Metadata> {
  const { city } = await params;
  const data = await cachedCity(city);
  if (!data) return { title: "Not found", robots: { index: false } };
  return {
    title: `Food vlogger picks in ${data.city.name}`,
    description: `${data.places.length} places in ${data.city.name} recommended by food vloggers, ranked by how many of them picked each one.`,
    alternates: { canonical: `/${data.city.slug}` },
  };
}

// Allowed to block: params are read before Suspense for the 404 check below.
export const instant = false;

export default async function CityPage({ params, searchParams }: PageProps<"/[city]">) {
  // Static registry check before Suspense: unknown slugs get a real 404 status, no DB at build.
  const { city } = await params;
  if (!CITIES.some((c) => c.slug === city)) notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <City params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function City({
  params,
  searchParams,
}: {
  params: PageProps<"/[city]">["params"];
  searchParams: PageProps<"/[city]">["searchParams"];
}) {
  const { city: slug } = await params;
  const diet = parseDiet((await searchParams).diet);
  const [data, areas] = await Promise.all([cachedCity(slug, diet), cachedAreas(slug)]);
  if (!data) notFound();

  return (
    <>
      <PageHead
        title={`Food vlogger picks in ${data.city.name}`}
        sub={`${data.places.length} ${data.places.length === 1 ? "place" : "places"}, ranked by how many creators picked each one`}
      />
      <DietFilter
        current={diet}
        href={(d) => (d ? `/${data.city.slug}?diet=${d}` : `/${data.city.slug}`)}
      />
      <section className="flex flex-col gap-3">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Most picked places</h2>
        <ListMapToggle
          key={diet ?? "all"}
          citySlug={data.city.slug}
          points={mapPoints(data.places)}
          cards={data.places}
          filter={{ diet }}
          heatmap={!diet}
          list={
            <NearMeList
              cards={data.places}
              citySlug={data.city.slug}
              emptyText={`No ${diet ? `${diet} ` : ""}picks yet for ${data.city.name}.`}
            />
          }
        />
      </section>
      {data.dishes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">By dish</h2>
          <DishRow citySlug={data.city.slug} cityName={data.city.name} dishes={data.dishes} />
        </section>
      )}
      <Link className="btn btn-line self-start" href={`/${slug}/walks`}>
        Food walks in {data.city.name}
      </Link>
      <Link className="btn btn-line self-start" href={`/${slug}/agree`}>
        Places more than one creator picked in {data.city.name}
      </Link>
      {areas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">By neighbourhood</h2>
          <nav aria-label="Neighbourhoods" className="flex flex-wrap gap-x-4 gap-y-1">
            {areas.map((a) => (
              <Link
                className="inline-flex min-h-11 items-center underline"
                key={a.slug}
                href={`/${slug}/area/${a.slug}`}
              >
                {a.name}
              </Link>
            ))}
          </nav>
        </section>
      )}
    </>
  );
}
