import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHead } from "../../../../components/PageHead";
import { Skeleton } from "../../../../components/Skeleton";
import { cityBySlug } from "../../../../lib/cities";
import { cachedWalks } from "../../data";
type Props = PageProps<"/[city]/walks">;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const name = cityBySlug(city)?.name ?? city;
  return {
    title: `Food walks in ${name}`,
    description: `Short food walks in ${name}: four or five places close together, each picked by food vloggers, with one Google Maps route.`,
    alternates: { canonical: `/${city}/walks` },
  };
}
async function Walks({ params }: Props) {
  const { city } = await params;
  const known = cityBySlug(city);
  if (!known) notFound();
  const walks = await cachedWalks(city);
  return (
    <>
      <PageHead
        title={`Food walks in ${known.name}`}
        back={{ href: `/${city}`, label: known.name }}
        sub="Four or five stops with exact map pins, picked by food vloggers."
      />
      {walks.length ? (
        <ul className="border-t-2 border-ink">
          {walks.map((w) => (
            <li key={w.slug} className="border-b border-line py-4">
              <Link
                className="type-lid inline-flex min-h-11 items-center text-[1.65rem] underline"
                href={`/${city}/walk/${w.slug}`}
              >
                {w.name}
              </Link>
              <p className="text-sm text-muted">
                {w.stops.length} stops · {(w.meters / 1000).toFixed(1)} km between pins,
                straight-line estimate
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="border-y border-line py-6 text-muted">
          No food walks meet the four-stop rule here yet. Approximate neighbourhood pins are
          excluded.
        </p>
      )}
    </>
  );
}
export default function WalksPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Walks {...props} />
    </Suspense>
  );
}
