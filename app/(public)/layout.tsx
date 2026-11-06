import Link from "next/link";

const SOON = ["Mumbai", "Kolkata"];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const optOut = process.env.NEXT_PUBLIC_OPTOUT_EMAIL;
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
        <Link
          href="/"
          className="min-h-11 content-center font-semibold focus-visible:outline-2 focus-visible:outline-accent"
        >
          Indian Food Recommends
        </Link>
        <nav aria-label="Cities" className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/delhi"
            className="min-h-11 content-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Delhi
          </Link>
          {SOON.map((city) => (
            <span key={city} className="text-muted">
              {city} (soon)
            </span>
          ))}
        </nav>
      </header>
      <main className="flex min-h-[100dvh] flex-1 flex-col gap-8 py-8">{children}</main>
      <footer className="flex flex-col gap-1 border-t border-line py-6 text-sm text-muted">
        <p>Picks come from the food vloggers credited on each page, with a link to their video.</p>
        <p>
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            About, content policy and creator opt-out
          </Link>
        </p>
        <p>
          {optOut ? (
            <>
              Creators can ask us to remove their picks:{" "}
              <a
                href={`mailto:${optOut}`}
                className="underline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {optOut}
              </a>
            </>
          ) : (
            "Creator opt-out contact coming soon."
          )}
        </p>
      </footer>
    </>
  );
}
