"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { MapPoint } from "./map-points";

const PlaceMap = dynamic(() => import("./PlaceMap"), {
  ssr: false,
  loading: () => <p className="text-muted">Loading map…</p>,
});

const tab =
  "min-h-11 rounded-[var(--radius-step)] border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** List is the default and the accessible alternative; the map loads only on demand. */
export function ListMapToggle({
  list,
  points,
  citySlug,
}: {
  list: React.ReactNode;
  points: MapPoint[];
  citySlug: string;
}) {
  const [view, setView] = useState<"list" | "map">("list");
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="View" className="flex gap-2">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`${tab} ${view === v ? "border-accent bg-accent text-paper" : "border-line"}`}
          >
            {v === "list" ? "List" : "Map"}
          </button>
        ))}
      </div>
      {view === "list" ? list : <PlaceMap points={points} citySlug={citySlug} />}
    </div>
  );
}
