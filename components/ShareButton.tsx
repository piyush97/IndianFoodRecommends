"use client";

import { useRef, useState } from "react";

/** Native share sheet where the browser has one (phones, where WhatsApp lives); copy-link elsewhere. */
export function ShareButton({
  url,
  title,
  text,
  slug,
}: {
  url: string;
  title: string;
  text: string;
  slug: string;
}) {
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function say(message: string) {
    setNote(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 4000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      say("Link copied");
    } catch {
      say("Could not copy. Copy the address from the browser bar.");
    }
  }

  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ url, title, text });
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if ((error as Error).name !== "AbortError") await copy();
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="btn btn-line"
        data-umami-event="share"
        data-umami-event-place={slug}
      >
        Share
        <span className="sr-only"> {title}</span>
      </button>
      <span role="status" className="text-sm text-muted">
        {note}
      </span>
    </span>
  );
}
