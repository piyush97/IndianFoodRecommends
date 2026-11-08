"use client";

import { useSearchParams } from "next/navigation";
import { SearchBar } from "./SearchBar";

/** The header search keeps the current query visible on /search. Keyed so it refills on navigation. */
export function HeaderSearch() {
  const q = useSearchParams().get("q") ?? "";
  return <SearchBar key={q} defaultValue={q} />;
}
