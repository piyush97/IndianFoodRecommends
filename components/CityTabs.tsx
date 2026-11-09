"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CITIES } from "../lib/cities";
import { ROUTE } from "./LidCode";

/**
 * City tabs: enamel tiles in each city's route colour. One scrolling row on phones so the tabs
 * cost 44px of height, not 150px; they wrap on wider screens. The tile for the city being
 * viewed carries an ink bar and aria-current. Cities with no picks yet read "soon".
 */
export function CityTabs({ active, here }: { active: string[]; here?: string }) {
  return (
    <nav
      aria-label="Cities"
      className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:overflow-visible sm:px-0"
    >
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap sm:gap-y-4">
        {CITIES.map((city) => {
          const route = ROUTE[city.slug];
          if (!active.includes(city.slug)) {
            return (
              <li key={city.slug}>
                <span className="type-lid inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-step)] px-3 text-base text-muted shadow-[inset_0_0_0_1.5px_var(--color-line)]">
                  {city.name}
                  <span className="text-xs font-semibold tracking-normal normal-case">soon</span>
                </span>
              </li>
            );
          }
          const current = here === city.slug;
          return (
            <li key={city.slug} className="relative">
              <Link
                href={`/${city.slug}`}
                aria-current={current ? "page" : undefined}
                className="enamel type-lid inline-flex min-h-11 items-center px-3 text-base no-underline"
                style={{ background: route?.bg, color: route?.fg }}
              >
                {city.name}
              </Link>
              {current && (
                <span aria-hidden="true" className="absolute inset-x-0 -bottom-2 h-1 bg-ink" />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Reads the URL, so it must sit inside a Suspense boundary. */
export function CurrentCityTabs({ active }: { active: string[] }) {
  return <CityTabs active={active} here={usePathname().split("/")[1]} />;
}
