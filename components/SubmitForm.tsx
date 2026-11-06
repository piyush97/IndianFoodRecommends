"use client";

import { useState } from "react";

const field =
  "min-h-11 w-full rounded-[var(--radius-step)] border border-line bg-paper px-3 font-normal focus-visible:outline-2 focus-visible:outline-accent";
const label = "flex flex-col gap-1 text-sm font-medium";

export function SubmitForm({
  creators,
  cities,
}: {
  creators: { slug: string; name: string }[];
  cities: { slug: string; name: string }[];
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("sending");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      if (res.ok) {
        setStatus("done");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not send the suggestion.");
      setStatus("error");
    } catch {
      setError("Could not send the suggestion. Check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p role="status" className="rounded-[var(--radius-card)] border border-line p-4">
        Thanks. We check every suggestion against the video before it shows.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className={label}>
        Video or reel link
        <input
          name="url"
          type="url"
          required
          maxLength={500}
          placeholder="https://www.youtube.com/watch?v=…"
          className={field}
        />
      </label>
      <label className={label}>
        Creator
        <select name="creatorSlug" required className={field}>
          {creators.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        City
        <select name="city" required className={field}>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Place name
        <input name="placeName" required minLength={2} maxLength={80} className={field} />
      </label>
      <label className={label}>
        Dish
        <input name="dishName" required minLength={2} maxLength={60} className={field} />
      </label>
      <label className={label}>
        Timestamp (optional)
        <input
          name="timestamp"
          inputMode="numeric"
          pattern="(\d{1,2}:)?\d{1,3}:\d{2}"
          placeholder="4:12"
          maxLength={10}
          aria-describedby="ts-help"
          className={field}
        />
        <span id="ts-help" className="font-normal text-muted">
          When the creator talks about the place, like 4:12 or 1:02:05.
        </span>
      </label>
      <button
        type="submit"
        disabled={status === "sending"}
        className="min-h-11 self-start rounded-[var(--radius-step)] bg-accent px-4 font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send for review"}
      </button>
      <p aria-live="polite" className="text-sm">
        {status === "error" && error}
      </p>
    </form>
  );
}
