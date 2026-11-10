"use client";
import { useEffect, useRef, useState } from "react";
import { CITIES } from "../lib/cities";
import type { PickCard } from "../lib/public/queries";
import { track } from "../lib/track";
import { nearMe, type NearMeResult, type Point } from "./near-me";
import { PickList } from "./PickList";

type State = "idle" | "locating" | "loading" | "result" | "denied" | "failed";
type Suggestion = { name: string; lat: number; lng: number };
type Source = "device" | "local" | "openstreetmap";

const PRIVACY: Record<Source, string> = {
  device: "Your location stays on this device.",
  local: "Matched against our own list of areas, nothing you typed left this site.",
  openstreetmap: "The text you typed was sent to OpenStreetMap to find it.",
};

/**
 * Opt-in "Picks near me". The device position is read only after the click and never sent anywhere:
 * the cached public index is downloaded (no coordinates in the request) and matched here. A typed
 * area goes to /api/geocode, which returns a point that is matched the same way.
 */
export function HomeNearMe() {
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<NearMeResult | null>(null);
  const [note, setNote] = useState("");
  const [source, setSource] = useState<Source>("device");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const area = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (state === "denied" || state === "failed") area.current?.focus();
  }, [state]);

  async function show(origin: Point, from: Source) {
    setState("loading");
    setSuggestions([]);
    try {
      const res = await fetch("/api/near-index");
      if (!res.ok) throw new Error();
      const { cards } = (await res.json()) as { cards: PickCard[] };
      const found = nearMe(cards, origin);
      setResult(found);
      setSource(from);
      track("near-me", {
        result: found.mode === "none" ? "none-nearby" : from === "device" ? "granted" : "area",
      });
      setState("result");
    } catch {
      setNote("Could not load picks. Try again.");
      setState("failed");
    } finally {
      inFlight.current = false;
    }
  }

  function locate() {
    if (inFlight.current) return;
    if (!("geolocation" in navigator)) {
      track("near-me", { result: "denied" });
      setState("denied");
      return;
    }
    inFlight.current = true;
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => void show({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "device"),
      (err) => {
        inFlight.current = false;
        // Code 1 is the visitor saying no; 2 and 3 (no fix, timeout) are not a refusal.
        if (err.code === 1) {
          track("near-me", { result: "denied" });
          setState("denied");
        } else {
          track("near-me", { result: "unavailable" });
          setNote("Could not find your location. Type an area instead.");
          setState("failed");
        }
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  function pick(choice: Suggestion) {
    if (inFlight.current) return;
    inFlight.current = true;
    void show({ lat: choice.lat, lng: choice.lng }, "local");
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(event.currentTarget);
    const q = String(form.get("q") ?? "").trim();
    if (q.length < 2) return;
    inFlight.current = true;
    setState("loading");
    setSuggestions([]);
    try {
      const res = await fetch(
        `/api/geocode?${new URLSearchParams({ city: String(form.get("city")), q })}`,
      );
      const body = (await res.json().catch(() => ({}))) as {
        lat?: number;
        lng?: number;
        error?: string;
        message?: string;
        via?: "local" | "openstreetmap";
        suggestions?: Suggestion[];
      };
      if (!res.ok || body.lat == null || body.lng == null) {
        setSuggestions(body.suggestions ?? []);
        setNote(
          body.error === "rate"
            ? (body.message ?? "Too many lookups. Try again in a moment.")
            : (body.error ?? "Could not search right now. Try again."),
        );
        setState("failed");
        inFlight.current = false;
        return;
      }
      await show({ lat: body.lat, lng: body.lng }, body.via ?? "openstreetmap");
    } catch {
      setNote("Could not search right now. Try again.");
      setState("failed");
      inFlight.current = false;
    }
  }

  const busy = state === "locating" || state === "loading";

  return (
    <div className="flex min-h-64 flex-col gap-3 sm:min-h-36">
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="btn btn-ink w-full sm:w-fit"
      >
        {state === "locating" ? "Finding you…" : "Picks near me"}
      </button>
      <form onSubmit={search} className="flex flex-col gap-1">
        <label htmlFor="near-q" className="text-sm font-medium">
          Area or landmark
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="near-city">
            City
          </label>
          <select
            id="near-city"
            name="city"
            defaultValue="delhi"
            className="field min-h-11 font-normal sm:w-40"
          >
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            id="near-q"
            aria-describedby="near-status"
            ref={area}
            name="q"
            type="search"
            required
            minLength={2}
            maxLength={80}
            autoComplete="off"
            className="field min-h-11 min-w-0 flex-1 font-normal sm:max-w-64"
          />
          <button type="submit" disabled={busy} className="btn btn-line shrink-0">
            Search area
          </button>
        </div>
      </form>
      <p id="near-status" role="status" className="text-sm text-muted">
        {state === "loading" && "Finding picks…"}
        {state === "denied" && "Location is off. Type an area instead."}
        {state === "failed" && note}
        {state === "result" &&
          result?.mode === "near" &&
          `Nearest first, more creators first within each 500 m. ${PRIVACY[source]}`}
        {state === "result" &&
          result?.mode === "far" &&
          `Nothing within 5 km. These are the closest picks. ${PRIVACY[source]}`}
        {state === "result" &&
          result?.mode === "none" &&
          "No picks near you yet. Browse a city below."}
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
      {state === "result" && result && result.mode !== "none" && (
        <section className="flex flex-col gap-2">
          <h2 className="type-lid text-[2rem]">
            {result.mode === "near" ? "Picks near you" : "Closest picks"}
          </h2>
          <PickList
            cards={result.cards.map((c) => ({ ...c, distanceM: Math.round(c.km * 1000) }))}
            numbered={false}
            headingLevel={3}
            distanceLabel="from you"
            emptyText="No picks near you yet. Browse a city below."
          />
        </section>
      )}
    </div>
  );
}
