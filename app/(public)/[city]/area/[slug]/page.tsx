import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHead } from "../../../../../components/PageHead";
import { PickList } from "../../../../../components/PickList";
import { ListMapToggle } from "../../../../../components/ListMapToggle";
import { mapPoints } from "../../../../../components/map-points";
import { Skeleton } from "../../../../../components/Skeleton";
import { cachedArea } from "../../../data";

type Props = PageProps<"/[city]/area/[slug]">;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, slug } = await params;
  const data = await cachedArea(city, slug);
  if (!data) return { title: "Area not found" };
  return {
    title: `Food in ${data.area.name}, ${data.area.cityName}`,
    description: `Food vlogger picks in ${data.area.name}, with dishes and source videos.`,
    alternates: { canonical: `/${city}/area/${slug}` },
    ...(data.places.length === 0 && { robots: { index: false, follow: true } }),
  };
}
async function AreaContent({ params }: Props) {
  const { city, slug } = await params;
  const data = await cachedArea(city, slug);
  if (!data) notFound();
  const { area, places } = data;
  return (
    <>
      <PageHead
        title={`Food in ${area.name}`}
        sub={`${places.length} ${places.length === 1 ? "place" : "places"} picked by food vloggers in ${area.cityName}`}
      />
      <p className="text-sm text-muted">
        {area.hasBoundary
          ? "Picks inside the OpenStreetMap neighbourhood boundary."
          : "No mapped boundary yet. Showing picks within 1 km of the area centre."}
        {area.osmId && (
          <>
            {" "}
            Area data:{" "}
            <a
              className="underline"
              href={`https://www.openstreetmap.org/${area.osmId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              © OpenStreetMap contributors
            </a>
            .
          </>
        )}{" "}
        Approximate pins are labelled.
      </p>
      <ListMapToggle
        citySlug={city}
        points={mapPoints(places)}
        cards={places}
        filter={{ area: slug }}
        list={
          <PickList
            cards={places}
            headingLevel={2}
            emptyText="No picks in this neighbourhood yet."
          />
        }
      />
      <Link className="btn btn-line self-start" href={`/${city}`}>
        All picks in {area.cityName}
      </Link>
    </>
  );
}
export default function AreaPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <AreaContent {...props} />
    </Suspense>
  );
}
