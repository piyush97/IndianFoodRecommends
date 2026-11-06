import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PickList } from "../../../components/PickList";
import { Skeleton } from "../../../components/Skeleton";
import { cachedCity } from "../data";

export default function CityPage({ params }: PageProps<"/[city]">) {
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
      <h1 className="text-3xl font-semibold tracking-tight">
        Food vlogger picks in {data.city.name}
      </h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">By dish</h2>
        {data.dishes.length === 0 ? (
          <p className="text-muted">No picks yet for {data.city.name}.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.dishes.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/${data.city.slug}/${d.slug}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {d.name}
                  <span className="text-sm text-muted">{d.picks}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Most picked places</h2>
        <PickList
          cards={data.places}
          citySlug={data.city.slug}
          emptyText={`No picks yet for ${data.city.name}.`}
        />
      </section>
    </>
  );
}
