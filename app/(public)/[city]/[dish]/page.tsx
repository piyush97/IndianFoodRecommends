import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../../../../components/JsonLd";
import { dishItemList } from "../../../../lib/seo/jsonld";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListMapToggle } from "../../../../components/ListMapToggle";
import { mapPoints } from "../../../../components/map-points";
import { NearMeList } from "../../../../components/NearMeList";
import { Skeleton } from "../../../../components/Skeleton";
import { cachedDish } from "../../data";

type Params = PageProps<"/[city]/[dish]">["params"];

export async function generateMetadata({ params }: PageProps<"/[city]/[dish]">): Promise<Metadata> {
  const { city, dish } = await params;
  const data = await cachedDish(city, dish);
  if (!data) return { title: "Not found", robots: { index: false } };
  const n = data.places.length;
  return {
    title: `${data.dish.name} in ${data.city.name}: where food vloggers eat`,
    description: `${n} ${n === 1 ? "place" : "places"} for ${data.dish.name} in ${data.city.name}, ranked by how many food vloggers picked them, with the video moment for each.`,
    alternates: { canonical: `/${data.city.slug}/${data.dish.slug}` },
  };
}

export default function DishPage({ params }: PageProps<"/[city]/[dish]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Dish params={params} />
    </Suspense>
  );
}

async function Dish({ params }: { params: Params }) {
  const { city, dish } = await params;
  const data = await cachedDish(city, dish);
  if (!data) notFound();

  const places = data.places.length;
  const creators = data.creatorCount;
  return (
    <>
      <JsonLd
        data={dishItemList({
          city: data.city.name,
          dish: data.dish.name,
          path: `/${data.city.slug}/${data.dish.slug}`,
          places: data.places.map((p) => ({
            name: p.placeName,
            path: `/${data.city.slug}/place/${p.placeSlug}`,
          })),
        })}
      />
      <div className="flex flex-col gap-2">
        <Link
          href={`/${data.city.slug}`}
          className="min-h-11 content-center text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← {data.city.name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {data.dish.name} in {data.city.name}
        </h1>
        {places > 0 && (
          <p className="text-muted">
            {places} {places === 1 ? "place" : "places"} picked by {creators} food{" "}
            {creators === 1 ? "vlogger" : "vloggers"}
          </p>
        )}
      </div>
      <ListMapToggle
        citySlug={data.city.slug}
        points={mapPoints(data.places)}
        list={
          <NearMeList
            headingLevel={2}
            cards={data.places}
            emptyText={`No picks yet for ${data.dish.name} in ${data.city.name}.`}
          />
        }
      />
    </>
  );
}
