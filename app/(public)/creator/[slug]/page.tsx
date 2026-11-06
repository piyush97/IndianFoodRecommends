import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PickList } from "../../../../components/PickList";
import { Skeleton } from "../../../../components/Skeleton";
import { cachedCreator } from "../../data";

type Props = PageProps<"/creator/[slug]">;

const field =
  "min-h-11 rounded-[var(--radius-step)] border border-line bg-paper px-3 focus-visible:outline-2 focus-visible:outline-accent";

export default function CreatorPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Creator params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Creator({ params, searchParams }: Props) {
  const { slug } = await params;
  const { dish } = await searchParams;
  const dishSlug = typeof dish === "string" && dish !== "" ? dish : undefined;
  const data = await cachedCreator(slug, dishSlug);
  if (!data) notFound();
  const { creator } = data;
  const active = data.dishes.find((d) => d.slug === dishSlug);

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{creator.name}</h1>
        <p className="text-muted">
          {data.total} {data.total === 1 ? "pick" : "picks"} · Delhi
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          {creator.ytChannelId && (
            <a
              href={`https://www.youtube.com/channel/${creator.ytChannelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent"
            >
              YouTube channel<span className="sr-only">, opens YouTube</span>
            </a>
          )}
          {creator.igHandle && (
            <a
              href={`https://www.instagram.com/${creator.igHandle}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent"
            >
              Instagram<span className="sr-only">, opens Instagram</span>
            </a>
          )}
        </div>
      </section>

      {data.dishes.length > 1 && (
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Dish
            <select name="dish" defaultValue={dishSlug ?? ""} className={field}>
              <option value="">All dishes</option>
              {data.dishes.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-[var(--radius-step)] border border-line px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent"
          >
            Filter
          </button>
        </form>
      )}

      <PickList
        cards={data.picks}
        citySlug="delhi"
        emptyText={
          active
            ? `No picks yet for ${active.name} by ${creator.name}.`
            : `No picks yet by ${creator.name} in Delhi.`
        }
      />
    </>
  );
}
