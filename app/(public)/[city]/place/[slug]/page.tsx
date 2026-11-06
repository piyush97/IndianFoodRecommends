import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "../../../../../components/JsonLd";
import { restaurantLd } from "../../../../../lib/seo/jsonld";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmbedFacade } from "../../../../../components/EmbedFacade";
import { MapOnDemand } from "../../../../../components/PlaceMapLazy";
import { ReportForm } from "../../../../../components/ReportForm";
import { Skeleton } from "../../../../../components/Skeleton";
import { directionsUrl, sourceUrl } from "../../../../../lib/public/links";
import { cachedPlace } from "../../../data";

type Params = PageProps<"/[city]/place/[slug]">["params"];

const action =
  "inline-flex min-h-11 items-center rounded-[var(--radius-step)] border border-line px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
      <section className="flex flex-col gap-2">
        <Link
          href={`/${data.city.slug}`}
          className="min-h-11 content-center text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← {data.city.name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{place.name}</h1>
        <p className="text-muted">
          {[place.locality, data.city.name].filter(Boolean).join(", ")}
          {place.lastVerified && ` · Last verified ${monthYear(place.lastVerified)}`}
        </p>
        {place.approx && (
          <p className="text-sm text-muted">
            Approximate location (neighbourhood). Check the video for the exact shop.
          </p>
        )}
        {directions && (
          <div>
            <a href={directions} target="_blank" rel="noopener noreferrer" className={action}>
              Directions
              <span className="sr-only"> to {place.name}, opens Google Maps</span>
            </a>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">What creators ordered</h2>
        <ul className="flex flex-col gap-1">
          {data.dishes.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/${data.city.slug}/${d.slug}`}
                className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {d.name}
                <span className="text-sm text-muted">
                  {d.creators} {d.creators === 1 ? "creator" : "creators"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Proof</h2>
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
                <Link
                  href={`/creator/${p.creator.slug}`}
                  className="font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {p.creator.name}
                </Link>{" "}
                · {p.dish}
                {" · "}
                <a
                  href={sourceUrl(p.platform, p.externalId, p.tsSeconds)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
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
          <h2 className="text-xl font-semibold">Map</h2>
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
