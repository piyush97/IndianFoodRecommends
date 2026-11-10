import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHead } from "../../../../../components/PageHead";
import { PickList } from "../../../../../components/PickList";
import { ListMapToggle } from "../../../../../components/ListMapToggle";
import { mapPoints } from "../../../../../components/map-points";
import { Skeleton } from "../../../../../components/Skeleton";
import { walkDirections } from "../../../../../lib/public/links";
import { cachedWalks } from "../../../data";
type Props = PageProps<"/[city]/walk/[slug]">;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, slug } = await params;
  const [walk] = await cachedWalks(city, slug);
  return {
    title: walk ? `${walk.name} in ${walk.cityName}` : "Walk not found",
    alternates: { canonical: `/${city}/walk/${slug}` },
  };
}
async function Walk({ params }: Props) {
  const { city, slug } = await params;
  const [walk] = await cachedWalks(city, slug);
  if (!walk) notFound();
  const directions = walkDirections(walk.stops);
  return (
    <>
      <PageHead
        title={walk.name}
        back={{ href: `/${city}/walks`, label: `Food walks in ${walk.cityName}` }}
        sub={`${walk.stops.length} exact-pin stops · ${(walk.meters / 1000).toFixed(1)} km between pins (straight-line estimate)`}
      />
      <p className="text-sm text-muted">
        Stops are ordered from the westernmost pin to its nearest next stop. Google Maps calculates
        the walking route. Updated {new Date(walk.updatedAt).toISOString().slice(0, 10)}.
      </p>
      {directions && (
        <a
          className="btn btn-ink self-start"
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open walking directions<span className="sr-only"> in Google Maps</span>
        </a>
      )}
      <ListMapToggle
        citySlug={city}
        points={mapPoints(walk.stops)}
        list={
          <PickList
            cards={walk.stops}
            headingLevel={2}
            emptyText="This walk is no longer available."
          />
        }
      />
    </>
  );
}
export default function WalkPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Walk {...props} />
    </Suspense>
  );
}
