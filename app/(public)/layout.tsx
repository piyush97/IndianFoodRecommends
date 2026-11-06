import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ROUTE } from "../../components/LidCode";
import { CITIES } from "../../lib/cities";
import { cachedCities } from "./data";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const optOut = process.env.NEXT_PUBLIC_OPTOUT_EMAIL;
  return (
    <>
      <header className="flex flex-col gap-3 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="type-lid min-h-11 content-center text-lg leading-none no-underline sm:text-xl"
          >
            Indian Food <span className="text-accent">Recommends</span>
          </Link>
          <Link
            href="/submit"
            className="min-h-11 shrink-0 content-center text-sm font-semibold whitespace-nowrap underline decoration-line underline-offset-4 hover:decoration-ink"
          >
            Suggest a pick
          </Link>
        </div>
        <Suspense fallback={<CityTabs active={new Set()} />}>
          <CityNav />
        </Suspense>
      </header>
      <main className="flex min-h-[100dvh] flex-1 flex-col gap-8 pt-4 pb-12">{children}</main>
      <footer className="flex flex-col gap-2 border-t-2 border-ink py-6 text-sm text-muted">
        <p className="text-ink">
          Every pick links to the food vlogger&apos;s own video. Places rank by how many different
          creators recommend them.
        </p>
        <p className="flex flex-wrap gap-x-4">
          <Link href="/about" className="inline-flex min-h-11 items-center underline">
            About and creator opt-out
          </Link>
          <Link href="/submit" className="inline-flex min-h-11 items-center underline">
            Suggest a pick
          </Link>
        </p>
        <p>
          {optOut ? (
            <>
              Creators can ask us to remove their picks:{" "}
              <a href={`mailto:${optOut}`} className="underline">
                {optOut}
              </a>
            </>
          ) : (
            "Creators: see the about page to have your picks removed."
          )}
        </p>
      </footer>
    </>
  );
}

/** Cities with picks are links; the rest of the registry shows as "soon". */
async function CityNav() {
  await connection();
  const active = new Set((await cachedCities()).map((c) => c.slug));
  return <CityTabs active={active} />;
}

/** City tabs as enamel tiles in each city's route colour. */
function CityTabs({ active }: { active: Set<string> }) {
  return (
    <nav aria-label="Cities" className="flex flex-wrap gap-2">
      {CITIES.map((city) => {
        const route = ROUTE[city.slug];
        if (!active.has(city.slug)) {
          return (
            <span
              key={city.slug}
              className="type-lid inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-step)] px-3 text-base text-muted shadow-[inset_0_0_0_1.5px_var(--color-line)]"
            >
              {city.name}
              <span className="text-xs font-semibold tracking-normal normal-case">soon</span>
            </span>
          );
        }
        return (
          <Link
            key={city.slug}
            href={`/${city.slug}`}
            className="enamel type-lid inline-flex min-h-11 items-center px-3 text-base no-underline"
            style={{ background: route?.bg, color: route?.fg }}
          >
            {city.name}
          </Link>
        );
      })}
    </nav>
  );
}
