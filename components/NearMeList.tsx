"use client";
import { useState } from "react";
import type { PickCard } from "../lib/public/queries";
import { sortByDistance, type Point } from "./near-me";
import { PickList } from "./PickList";

type State = "ranked" | "locating" | "searching" | "nearest" | "area" | "denied" | "failed";

/**
 * Opt-in distance sort, from the device position or from a typed area. The device position is
 * read only after the click and never leaves the browser: sorting happens here on coordinates
 * already in the page. A typed area is sent to OpenStreetMap search through /api/geocode.
 */
export function NearMeList({
  cards,
  citySlug,
  emptyText,
  headingLevel,
}: {
  cards: PickCard[];
  citySlug: string;
  emptyText: string;
  headingLevel?: 2 | 3;
}) {
  const [state, setState] = useState<State>("ranked");
  // Kept as a point, not a sorted copy, so new `cards` (a diet filter) are re-sorted.
  const [origin, setOrigin] = useState<Point | null>(null);
  const [note, setNote] = useState("");

  function reset() {
    setOrigin(null);
    setState("ranked");
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setState("nearest");
      },
      () => {
        setOrigin(null);
        setState("denied");
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (q.length < 2) return;
    setState("searching");
    try {
      const res = await fetch(`/api/geocode?${new URLSearchParams({ city: citySlug, q })}`);
      const body = (await res.json()) as {
        lat?: number;
        lng?: number;
        label?: string;
        error?: string;
      };
      if (!res.ok || body.lat == null || body.lng == null) {
        throw new Error(body.error ?? "Could not search right now.");
      }
      setOrigin({ lat: body.lat, lng: body.lng });
      setNote(body.label ?? q);
      setState("area");
    } catch (error) {
      setOrigin(null);
      setNote(error instanceof Error ? error.message : "Could not search right now.");
      setState("failed");
    }
  }

  const sorted = origin ? sortByDistance(cards, origin) : cards;
  const sortedByDistance = state === "nearest" || state === "area";
  const busy = state === "locating" || state === "searching";

  return (
    <div className="flex flex-col gap-3">
      {cards.some((c) => c.lat !== null) && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {sortedByDistance ? (
              <button type="button" onClick={reset} className="btn btn-line">
                Sort by most picked
              </button>
            ) : (
              <button type="button" onClick={locate} disabled={busy} className="btn btn-line">
                {state === "locating" ? "Finding you…" : "Sort by distance from me"}
              </button>
            )}
          </div>
          <form onSubmit={search} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Or sort from an area or landmark
              <input
                name="q"
                type="search"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
                placeholder="e.g. Connaught Place"
                className="field min-h-11 w-64 max-w-full font-normal"
              />
            </label>
            <button type="submit" disabled={busy} className="btn btn-line">
              {state === "searching" ? "Searching…" : "Sort from here"}
            </button>
          </form>
          <p aria-live="polite" className="text-sm text-muted">
            {state === "nearest" && "Nearest first. Your location stays on this device."}
            {state === "area" &&
              `Nearest first to “${note}”. The text you typed was sent to OpenStreetMap to find it.`}
            {state === "denied" && "Location is off, showing most picked first."}
            {state === "failed" && `${note} Showing most picked first.`}
          </p>
        </div>
      )}
      <PickList
        cards={sorted}
        emptyText={emptyText}
        headingLevel={headingLevel}
        numbered={!sortedByDistance}
      />
    </div>
  );
}
