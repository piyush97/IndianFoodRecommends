"use client";

import { useState } from "react";
import type { MapPoint } from "./map-points";
import { PlaceMapLazy as PlaceMap } from "./PlaceMapLazy";

const tab = "min-h-11 px-5 text-sm font-bold uppercase tracking-wide";

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
      <div
        role="group"
        aria-label="View"
        className="inline-flex self-start overflow-hidden rounded-[var(--radius-step)] shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
      >
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`${tab} ${view === v ? "bg-ink text-paper" : "text-ink hover:bg-cloth"}`}
          >
            {v === "list" ? "List" : "Map"}
          </button>
        ))}
      </div>
      {view === "list" ? list : <PlaceMap points={points} citySlug={citySlug} />}
    </div>
  );
}
