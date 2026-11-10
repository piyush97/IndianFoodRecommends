"use client";

import { useState } from "react";
import { track } from "../lib/track";

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
        track("report", { kind: String(form.get("kind")) });
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
    <details className="group border-y border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 font-semibold [&::-webkit-details-marker]:hidden">
        Report a problem with {placeName}
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200 group-open:rotate-180"
        >
          <path d="m3 5 4 4 4-4" />
        </svg>
      </summary>
      {status === "done" ? (
        <p role="status" className="mt-3">
          Thanks, we will check this place.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3 pb-4">
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
            <textarea name="message" maxLength={500} rows={3} className="field py-2 font-normal" />
          </label>
          <button type="submit" disabled={status === "sending"} className="btn btn-ink self-start">
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
