"use client";

import { useState } from "react";

const KINDS = [
  ["closed", "Closed for good"],
  ["moved", "Moved to a new address"],
  ["wrong-info", "Wrong name, dish or location"],
  ["other", "Something else"],
] as const;

export function ReportForm({ placeId, placeName }: { placeId: number; placeName: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placeId,
          kind: form.get("kind"),
          message: String(form.get("message") ?? "").trim() || undefined,
        }),
      });
      if (res.ok) {
        setStatus("done");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not send the report.");
      setStatus("error");
    } catch {
      setError("Could not send the report. Check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <details className="rounded-[var(--radius-card)] border border-line p-4">
      <summary className="min-h-11 cursor-pointer content-center font-medium focus-visible:outline-2 focus-visible:outline-accent">
        Report a problem with {placeName}
      </summary>
      {status === "done" ? (
        <p role="status" className="mt-3">
          Thanks, we will check this place.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">What is wrong?</legend>
            {KINDS.map(([value, label], i) => (
              <label key={value} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="kind" value={value} required defaultChecked={i === 0} />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Details (optional)
            <textarea
              name="message"
              maxLength={500}
              rows={3}
              className="rounded-[var(--radius-step)] border border-line bg-paper px-3 py-2 font-normal focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          <button
            type="submit"
            disabled={status === "sending"}
            className="min-h-11 self-start rounded-[var(--radius-step)] bg-accent px-4 font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Send report"}
          </button>
          <p aria-live="polite" className="text-sm">
            {status === "error" && error}
          </p>
        </form>
      )}
    </details>
  );
}
