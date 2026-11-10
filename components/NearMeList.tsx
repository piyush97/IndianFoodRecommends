"use client";
import { useState } from "react";
import type { PickCard } from "../lib/public/queries";
import { track } from "../lib/track";
import { sortByDistance, type Point } from "./near-me";
import { PickList } from "./PickList";

type State = "ranked" | "locating" | "searching" | "nearest" | "area" | "denied" | "failed";
type Suggestion = { name: string; lat: number; lng: number };

/**
 * Opt-in distance sort, from the device position or from a typed area. The device position is
 * read only after the click and never leaves the browser: sorting happens here on coordinates
 * already in the page. A typed area goes to /api/geocode: matched against our own list of areas
 * first (misspellings and nicknames included), and only if that fails sent to OpenStreetMap.
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
  const [via, setVia] = useState<"local" | "openstreetmap">("local");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  function reset() {
    setOrigin(null);
    setSuggestions([]);
    setState("ranked");
  }

  function pick(choice: Suggestion) {
    setOrigin({ lat: choice.lat, lng: choice.lng });
    setNote(choice.name);
    setVia("local");
    setSuggestions([]);
    track("near-me", { result: "area" });
    setState("area");
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      track("near-me", { result: "denied" });
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        track("near-me", { result: "granted" });
        setState("nearest");
      },
      () => {
        setOrigin(null);
        track("near-me", { result: "denied" });
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
    setSuggestions([]);
    try {
      const res = await fetch(`/api/geocode?${new URLSearchParams({ city: citySlug, q })}`);
      const body = (await res.json()) as {
        lat?: number;
        lng?: number;
        label?: string;
        via?: "local" | "openstreetmap";
        error?: string;
        suggestions?: Suggestion[];
      };
      if (!res.ok || body.lat == null || body.lng == null) {
        setSuggestions(body.suggestions ?? []);
        throw new Error(body.error ?? "Could not search right now.");
      }
      setOrigin({ lat: body.lat, lng: body.lng });
      setNote(body.label ?? q);
      setVia(body.via ?? "openstreetmap");
      track("near-me", { result: "area" });
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
          <form onSubmit={search} className="flex flex-col gap-1">
            <label htmlFor="area-q" className="text-sm font-medium">
              Or sort from an area or landmark
            </label>
            <div className="flex gap-2">
              <input
                id="area-q"
                name="q"
                type="search"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
                placeholder="Area or landmark"
                className="field min-h-11 min-w-0 flex-1 font-normal sm:max-w-64 sm:flex-none sm:basis-64"
              />
              <button type="submit" disabled={busy} className="btn btn-line shrink-0">
                {state === "searching" ? "Searching…" : "Sort from here"}
              </button>
            </div>
          </form>
          <p aria-live="polite" className="text-sm text-muted">
            {state === "nearest" && "Nearest first. Your location stays on this device."}
            {state === "area" &&
              `Nearest first to “${note}”. ${
                via === "local"
                  ? "Matched against our own list of areas, nothing you typed left this site."
                  : "The text you typed was sent to OpenStreetMap to find it."
              }`}
            {state === "denied" && "Location is off, showing most picked first."}
            {state === "failed" && `${note} Showing most picked first.`}
          </p>
          {state === "failed" && suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Did you mean</span>
              {suggestions.map((choice) => (
                <button
                  key={choice.name}
                  type="button"
                  onClick={() => pick(choice)}
                  className="btn btn-line"
                >
                  {choice.name}
                </button>
              ))}
            </div>
          )}
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
