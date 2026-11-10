"use client";
import { useEffect, useRef, useState } from "react";
import { CITIES } from "../lib/cities";
import type { PickCard } from "../lib/public/queries";
import { track } from "../lib/track";
import { nearMe, type NearMeResult, type Point } from "./near-me";
import { PickList } from "./PickList";

type State = "idle" | "locating" | "loading" | "result" | "denied" | "failed";

/**
 * Opt-in "Picks near me". The device position is read only after the click and never sent anywhere:
 * the cached public index is downloaded (no coordinates in the request) and matched here. A typed
 * area goes to /api/geocode, which returns a point that is matched the same way.
 */
export function HomeNearMe() {
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<NearMeResult | null>(null);
  const [note, setNote] = useState("");
  const area = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "denied") area.current?.focus();
  }, [state]);

  async function show(origin: Point, via: "granted" | "area") {
    setState("loading");
    try {
      const res = await fetch("/api/near-index");
      if (!res.ok) throw new Error();
      const { cards } = (await res.json()) as { cards: PickCard[] };
      const found = nearMe(cards, origin);
      setResult(found);
      track("near-me", { result: found.mode === "none" ? "none-nearby" : via });
      setState("result");
    } catch {
      setNote("Could not load picks. Try again.");
      setState("failed");
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      track("near-me", { result: "denied" });
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => void show({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "granted"),
      () => {
        track("near-me", { result: "denied" });
        setState("denied");
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const q = String(form.get("q") ?? "").trim();
    if (q.length < 2) return;
    setState("loading");
    try {
      const res = await fetch(
        `/api/geocode?${new URLSearchParams({ city: String(form.get("city")), q })}`,
      );
      const body = (await res.json()) as { lat?: number; lng?: number; error?: string };
      if (!res.ok || body.lat == null || body.lng == null) {
        throw new Error(body.error ?? "Could not find that area.");
      }
      await show({ lat: body.lat, lng: body.lng }, "area");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not find that area.");
      setState("failed");
    }
  }

  const busy = state === "locating" || state === "loading";

  return (
    <div className="flex min-h-72 flex-col gap-3 sm:min-h-56">
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
      <div aria-live="polite" className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          {state === "loading" && "Finding picks…"}
          {state === "denied" && "Location is off. Type an area instead."}
          {state === "failed" && note}
          {state === "result" &&
            result?.mode === "near" &&
            "Nearest first, more creators first within each 500 m. Your location stays on this device."}
          {state === "result" &&
            result?.mode === "far" &&
            "Nothing within 5 km. These are the closest picks. Your location stays on this device."}
          {state === "result" &&
            result?.mode === "none" &&
            "No picks near you yet. Browse a city below."}
        </p>
        {state === "result" && result && result.mode !== "none" && (
          <section className="flex flex-col gap-2">
            <h2 className="type-lid text-[2rem]">Picks near you</h2>
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
    </div>
  );
}
