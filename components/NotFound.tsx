import Link from "next/link";

const link = "btn btn-line";

/** Shared by the public and root not-found pages. */
export function NotFound() {
  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="type-lid text-[2.2rem]">Page not found</h1>
      <p className="text-muted">
        This address has no picks. The place or creator may have been removed, or the link has a
        typo.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="btn btn-ink">
          Browse by city
        </Link>
        <Link href="/search" className={link}>
          Search a dish
        </Link>
        <Link href="/submit" className={link}>
          Suggest a pick
        </Link>
      </div>
    </section>
  );
}
