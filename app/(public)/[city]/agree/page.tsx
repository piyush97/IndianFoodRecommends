import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CreatorAvatar } from "../../../../components/CreatorAvatar";
import { JsonLd } from "../../../../components/JsonLd";
import { LidCode } from "../../../../components/LidCode";
import { PageHead } from "../../../../components/PageHead";
import { Skeleton } from "../../../../components/Skeleton";
import { cityBySlug } from "../../../../lib/cities";
import { formatTs, sourceUrl } from "../../../../lib/public/links";
import { agreeTitle } from "../../../../lib/public/queries";
import { placeItemList } from "../../../../lib/seo/jsonld";
import { cachedAgree } from "../../data";

type Props = PageProps<"/[city]/agree">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  if (!cityBySlug(city)) return { title: "Not found", robots: { index: false } };
  const data = await cachedAgree(city);
  if (!data) return { title: "Not found", robots: { index: false } };
  const n = data.places.length;
  return {
    title: agreeTitle(n, data.city.name),
    description: `Places in ${data.city.name} picked by two or more food creators, with what each creator ordered and the video moment.`,
    alternates: { canonical: `/${data.city.slug}/agree` },
    ...(n === 0 && { robots: { index: false, follow: true } }),
  };
}

async function Agree({ params }: Props) {
  const { city } = await params;
  if (!cityBySlug(city)) notFound();
  const data = await cachedAgree(city);
  if (!data) notFound();
  const { places } = data;
  return (
    <>
      <JsonLd
        data={placeItemList({
          name: agreeTitle(places.length, data.city.name),
          path: `/${data.city.slug}/agree`,
          places: places.map((p) => ({
            name: p.placeName,
            path: `/${data.city.slug}/place/${p.placeSlug}`,
          })),
        })}
      />
      <PageHead
        back={{ href: `/${data.city.slug}`, label: data.city.name }}
        title={agreeTitle(places.length, data.city.name)}
        sub="Most creators first. Under each creator: what they ordered and the moment in their video."
      />
      {places.length ? (
        <ol className="border-t-2 border-ink">
          {places.map((p) => (
            <li key={p.placeSlug} className="border-b border-line py-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="type-lid text-[1.65rem]">
                    <Link
                      href={`/${data.city.slug}/place/${p.placeSlug}`}
                      className="decoration-2 underline-offset-4 hover:underline"
                    >
                      {p.placeName}
                    </Link>
                  </h2>
                  {(p.locality || p.approx) && (
                    <p className="mt-1 text-sm text-muted">
                      {p.locality}
                      {p.approx && <span>{p.locality ? " · " : ""}approximate pin</span>}
                    </p>
                  )}
                  <p className="mt-1.5 text-sm">Picked by {p.creators.length} creators</p>
                </div>
                <LidCode citySlug={data.city.slug} creators={p.creators.length} />
              </div>
              <ul className="mt-2 flex flex-col">
                {p.creators.map((c) => (
                  <li key={c.slug} className="border-t border-line py-2 first:border-t-0">
                    <Link
                      href={`/creator/${c.slug}`}
                      className="inline-flex min-h-11 items-center gap-2 font-semibold underline"
                    >
                      <CreatorAvatar name={c.name} avatarUrl={c.avatarUrl} size={24} />
                      {c.name}
                    </Link>
                    <ul className="flex flex-wrap gap-x-4">
                      {c.picks.map((pick) => {
                        const ts = formatTs(pick.tsSeconds);
                        return (
                          <li key={`${pick.externalId}-${pick.dish}`}>
                            <a
                              href={sourceUrl(pick.platform, pick.externalId, pick.tsSeconds)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center text-sm underline"
                              data-umami-event="watch"
                              data-umami-event-place={p.placeSlug}
                            >
                              {pick.dish}
                              {ts ? ` at ${ts}` : ""}
                              <span className="sr-only">
                                , {c.name}&apos;s video, opens{" "}
                                {pick.platform === "youtube" ? "YouTube" : "Instagram"}
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p role="status" className="border-y border-line py-6 text-muted">
          No place in {data.city.name} has picks from two or more creators yet.
        </p>
      )}
    </>
  );
}

export default function AgreePage(props: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Agree {...props} />
    </Suspense>
  );
}
