import type { Metadata } from "next";
import { PageHead } from "../../../../components/PageHead";
import { JsonLd } from "../../../../components/JsonLd";
import { dishItemList } from "../../../../lib/seo/jsonld";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShareButton } from "../../../../components/ShareButton";
import { absoluteUrl } from "../../../../lib/seo/site";
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
      <PageHead
        back={{ href: `/${data.city.slug}`, label: data.city.name }}
        title={`${data.dish.name} in ${data.city.name}`}
        sub={
          places > 0
            ? `${places} ${places === 1 ? "place" : "places"} picked by ${creators} food ${creators === 1 ? "vlogger" : "vloggers"}`
            : undefined
        }
      >
        <ShareButton
          url={absoluteUrl(`/${data.city.slug}/${data.dish.slug}`)}
          title={`${data.dish.name} in ${data.city.name}`}
          text={`${data.dish.name} in ${data.city.name}: ${places} ${places === 1 ? "place" : "places"}, picked by ${creators} food ${creators === 1 ? "vlogger" : "vloggers"}`}
          slug={data.dish.slug}
        />
      </PageHead>
      <ListMapToggle
        citySlug={data.city.slug}
        points={mapPoints(data.places)}
        cards={data.places}
        filter={{ dish: data.dish.slug }}
        list={
          <NearMeList
            headingLevel={2}
            citySlug={data.city.slug}
            cards={data.places}
            emptyText={`No picks yet for ${data.dish.name} in ${data.city.name}.`}
          />
        }
      />
    </>
  );
}
