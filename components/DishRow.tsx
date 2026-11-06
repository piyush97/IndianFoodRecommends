import Link from "next/link";

/**
 * Dishes as one row of text links that scrolls sideways on phones and wraps on
 * wide screens, so it never pushes the ranked picks below the fold.
 */
export function DishRow({
  citySlug,
  cityName,
  dishes,
  limit,
  showAll = false,
}: {
  citySlug: string;
  cityName: string;
  dishes: { slug: string; name: string; picks: number }[];
  limit?: number;
  showAll?: boolean;
}) {
  const shown = limit ? dishes.slice(0, limit) : dishes;
  return (
    <nav
      aria-label={`Dishes in ${cityName}`}
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max gap-x-5 sm:w-auto sm:flex-wrap">
        {shown.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/${citySlug}/${d.slug}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold whitespace-nowrap underline decoration-line underline-offset-4 hover:decoration-ink"
            >
              {d.name}
              <span className="font-normal text-muted tabular-nums">{d.picks}</span>
            </Link>
          </li>
        ))}
        {showAll && (
          <li>
            <Link
              href={`/${citySlug}`}
              className="inline-flex min-h-11 items-center text-sm font-bold whitespace-nowrap"
            >
              All of {cityName}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
