import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DishRow } from "../../../components/DishRow";
import { PageHead } from "../../../components/PageHead";
import { NearMeList } from "../../../components/NearMeList";
import { Skeleton } from "../../../components/Skeleton";
import { CITIES } from "../../../lib/cities";
import { cachedCity } from "../data";

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

export async function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

// Check existence before the Suspense boundary: notFound() inside a streamed
// boundary arrives after the 200 status line (soft 404).
export default async function CityPage({ params }: PageProps<"/[city]">) {
  if (!(await cachedCity((await params).city))) notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <City params={params} />
    </Suspense>
  );
}

async function City({ params }: { params: PageProps<"/[city]">["params"] }) {
  const { city: slug } = await params;
  const data = await cachedCity(slug);
  if (!data) notFound();

  return (
    <>
      <PageHead
        title={`Food vlogger picks in ${data.city.name}`}
        sub={`${data.places.length} ${data.places.length === 1 ? "place" : "places"}, ranked by how many creators picked each one`}
      />
      <section className="flex flex-col gap-3">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Most picked places</h2>
        <NearMeList cards={data.places} emptyText={`No picks yet for ${data.city.name}.`} />
      </section>
      {data.dishes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">By dish</h2>
          <DishRow citySlug={data.city.slug} cityName={data.city.name} dishes={data.dishes} />
        </section>
      )}
    </>
  );
}
