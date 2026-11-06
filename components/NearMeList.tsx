"use client";

import { useState } from "react";
import type { PickCard } from "../lib/public/queries";
import { sortByDistance } from "./near-me";
import { PickList } from "./PickList";

type State = "ranked" | "locating" | "nearest" | "denied";

/**
 * Opt-in distance sort. The position is read only after the click and never
 * leaves the browser: sorting happens here on coordinates already in the page.
 */
export function NearMeList({
  cards,
  emptyText,
  headingLevel,
}: {
  cards: PickCard[];
  emptyText: string;
  headingLevel?: 2 | 3;
}) {
  const [state, setState] = useState<State>("ranked");
  const [sorted, setSorted] = useState(cards);

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSorted(sortByDistance(cards, { lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setState("nearest");
      },
      () => {
        setSorted(cards);
        setState("denied");
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.some((c) => c.lat !== null) && (
        <div className="flex flex-wrap items-center gap-3">
          {state === "nearest" ? (
            <button
              type="button"
              onClick={() => {
                setSorted(cards);
                setState("ranked");
              }}
              className="min-h-11 rounded-[var(--radius-step)] border border-line px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sort by most picked
            </button>
          ) : (
            <button
              type="button"
              onClick={locate}
              disabled={state === "locating"}
              className="min-h-11 rounded-[var(--radius-step)] border border-line px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
            >
              {state === "locating" ? "Finding you…" : "Sort by distance from me"}
            </button>
          )}
          <p aria-live="polite" className="text-sm text-muted">
            {state === "nearest" && "Nearest first. Your location stays on this device."}
            {state === "denied" && "Location is off, showing most picked first."}
          </p>
        </div>
      )}
      <PickList
        cards={sorted}
        emptyText={emptyText}
        headingLevel={headingLevel}
        numbered={state !== "nearest"}
      />
    </div>
  );
}
