import type { Metadata } from "next";
import Link from "next/link";
import { LidCode } from "../../../../../components/LidCode";
import { PageHead } from "../../../../../components/PageHead";
import { ArrowIcon } from "../../../../../components/PickList";
import { JsonLd } from "../../../../../components/JsonLd";
import { restaurantLd } from "../../../../../lib/seo/jsonld";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShareButton } from "../../../../../components/ShareButton";
import { absoluteUrl } from "../../../../../lib/seo/site";
import { EmbedFacade } from "../../../../../components/EmbedFacade";
import { MapOnDemand } from "../../../../../components/PlaceMapLazy";
import { ReportForm } from "../../../../../components/ReportForm";
import { Skeleton } from "../../../../../components/Skeleton";
import { directionsUrl, sourceUrl } from "../../../../../lib/public/links";
import { cachedPlace } from "../../../data";

type Params = PageProps<"/[city]/place/[slug]">["params"];

const action = "btn btn-line";

export async function generateMetadata({
  params,
}: PageProps<"/[city]/place/[slug]">): Promise<Metadata> {
  const { city, slug } = await params;
  const data = await cachedPlace(city, slug);
  if (!data) return { title: "Not found", robots: { index: false } };
  const creators = new Set(data.proofs.map((p) => p.creator.slug)).size;
  const where = [data.place.locality, data.city.name].filter(Boolean).join(", ");
  return {
    title: `${data.place.name}, ${where}: picked by ${creators} food ${creators === 1 ? "vlogger" : "vloggers"}`,
    description: `What food vloggers ordered at ${data.place.name}: ${data.dishes.map((d) => d.name).join(", ")}. Watch each video at the moment they eat it.`,
    alternates: { canonical: `/${data.city.slug}/place/${data.place.slug}` },
  };
}

export default function PlacePage({ params }: PageProps<"/[city]/place/[slug]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Place params={params} />
    </Suspense>
  );
}

function monthYear(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function Place({ params }: { params: Params }) {
  const { city, slug } = await params;
  const data = await cachedPlace(city, slug);
  if (!data) notFound();
  const { place } = data;
  const directions = directionsUrl(place.lat, place.lng);
  const vloggers = new Set(data.proofs.map((p) => p.creator.slug)).size;

  return (
    <>
      <JsonLd
        data={restaurantLd({
          name: place.name,
          path: `/${data.city.slug}/place/${place.slug}`,
          locality: place.locality,
          city: data.city.name,
          lat: place.lat,
          lng: place.lng,
          dishes: data.dishes.map((d) => d.name),
        })}
      />
      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <PageHead
            back={{ href: `/${data.city.slug}`, label: data.city.name }}
            title={place.name}
            sub={
              <>
                {[place.locality, data.city.name].filter(Boolean).join(", ")}
                {place.lastVerified && ` · Last verified ${monthYear(place.lastVerified)}`}
              </>
            }
          />
          <div className="mt-14">
            <LidCode
              citySlug={data.city.slug}
              creators={new Set(data.proofs.map((p) => p.creator.slug)).size}
              size="lg"
            />
          </div>
        </div>
        {place.approx && (
          <p className="text-sm text-muted">
            Approximate location (neighbourhood). Check the video for the exact shop.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className={action}
              data-umami-event="directions"
              data-umami-event-place={place.slug}
            >
              <ArrowIcon />
              Directions
              <span className="sr-only"> to {place.name}, opens Google Maps</span>
            </a>
          )}
          <ShareButton
            url={absoluteUrl(`/${data.city.slug}/place/${place.slug}`)}
            title={place.name}
            text={`${place.name}, ${data.city.name}: picked by ${vloggers} food ${vloggers === 1 ? "vlogger" : "vloggers"}`}
            slug={place.slug}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">
          What creators ordered
        </h2>
        <ul>
          {data.dishes.map((d) => (
            <li key={d.slug} className="border-b border-line">
              <Link
                href={`/${data.city.slug}/${d.slug}`}
                className="flex min-h-12 items-center justify-between gap-3 py-2 font-semibold no-underline hover:underline"
              >
                {d.name}
                <span className="text-sm font-normal text-muted tabular-nums">
                  {d.creators} {d.creators === 1 ? "creator" : "creators"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Proof</h2>
        <ul className="flex flex-col gap-6">
          {data.proofs.map((p) => (
            <li key={`${p.platform}-${p.externalId}-${p.dish}`} className="flex flex-col gap-2">
              <EmbedFacade
                platform={p.platform}
                externalId={p.externalId}
                tsSeconds={p.tsSeconds}
                creator={p.creator.name}
              />
              <p className="text-sm">
                <Link href={`/creator/${p.creator.slug}`} className="font-semibold underline">
                  {p.creator.name}
                </Link>{" "}
                · {p.dish}
                {" · "}
                <a
                  href={sourceUrl(p.platform, p.externalId, p.tsSeconds)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Open original
                </a>
              </p>
              {p.note && <p className="text-sm text-muted">{p.note}</p>}
            </li>
          ))}
        </ul>
      </section>

      {place.lat !== null && place.lng !== null && (
        <section className="flex flex-col gap-3">
          <h2 className="type-lid border-b-2 border-ink pb-2 text-[1.75rem]">Map</h2>
          <MapOnDemand
            citySlug={data.city.slug}
            points={[
              {
                slug: place.slug,
                name: place.name,
                lat: place.lat,
                lng: place.lng,
                approx: place.approx,
              },
            ]}
          />
        </section>
      )}

      <ReportForm placeId={place.id} placeName={place.name} />
    </>
  );
}
