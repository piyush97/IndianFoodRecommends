"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapPoint } from "./map-points";
import { mapPoints } from "./map-points";
import type { PickCard } from "../lib/public/queries";
import type { Bounds, MapFilter } from "../lib/public/spatial";
import { PickList } from "./PickList";
import { PlaceMapLazy as PlaceMap } from "./PlaceMapLazy";

const tab =
  "focus-visible:outline-offset-[-3px] min-h-11 px-5 text-sm font-bold uppercase tracking-wide";

/** List is the default and the accessible alternative; the map loads only on demand. */
export function ListMapToggle({
  list,
  points,
  citySlug,
  cards,
  filter,
  heatmap = false,
}: {
  list: React.ReactNode;
  points: MapPoint[];
  citySlug: string;
  cards?: PickCard[];
  filter?: MapFilter;
  heatmap?: boolean;
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const onBounds = useCallback((b: Bounds) => setBounds(b), []);
  const [result, setResult] = useState<PickCard[] | null>(null);
  const shownPoints = useMemo(() => (result ? mapPoints(result) : points), [result, points]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function search() {
    if (!bounds) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    const params = new URLSearchParams({ city: citySlug, bbox: bounds.join(",") });
    for (const [k, v] of Object.entries(filter ?? {})) if (v) params.set(k, v);
    try {
      const res = await fetch(`/api/places?${params}`, { signal: controller.signal });
      const body = await res.json();
      if (!res.ok || !Array.isArray(body.cards))
        throw new Error("Could not search this area. Please retry.");
      setResult(body.cards);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : "Could not search this area.");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="View"
        className="inline-flex self-start rounded-[var(--radius-step)] shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
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
      {result && (
        <button
          className="btn btn-line self-start"
          onClick={() => {
            request.current?.abort();
            setPending(false);
            setResult(null);
            setError("");
          }}
        >
          Reset map search
        </button>
      )}
      {view === "list" ? (
        result ? (
          <PickList cards={result} headingLevel={2} emptyText="No picks in this map area." />
        ) : (
          list
        )
      ) : (
        <>
          <PlaceMap
            points={shownPoints}
            citySlug={citySlug}
            filter={filter}
            onBounds={cards ? onBounds : undefined}
            heatmap={heatmap}
          />
          {cards && (
            <>
              <button
                className="btn btn-ink self-start"
                disabled={!bounds || pending}
                onClick={search}
                aria-busy={pending}
              >
                {pending ? "Searching area…" : "Search this area"}
              </button>
              <p role="status" className="text-sm text-muted">
                {error ||
                  (result
                    ? `${result.length} picks in view. Up to 300 shown; zoom in for a smaller area.`
                    : "Pan or zoom the map, then search this area. The list below matches the pins.")}
              </p>
              <PickList
                cards={result ?? cards}
                headingLevel={2}
                emptyText="No picks in this map area."
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
