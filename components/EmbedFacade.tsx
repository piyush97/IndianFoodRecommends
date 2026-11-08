"use client";

import { useEffect, useRef, useState } from "react";
import { formatTs, youtubeEmbedUrl, type Platform } from "../lib/public/links";

/** Nothing from YouTube or Instagram loads until the visitor asks for it. */
export function EmbedFacade({
  platform,
  externalId,
  tsSeconds,
  creator,
}: {
  platform: Platform;
  externalId: string;
  tsSeconds: number | null;
  creator: string;
}) {
  const [open, setOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // Keep keyboard users in place: the button they pressed is replaced by the frame.
  useEffect(() => {
    if (open) frame.current?.focus();
  }, [open]);
  const ts = formatTs(tsSeconds);
  const label =
    platform === "instagram"
      ? `Open ${creator}'s reel`
      : ts
        ? `Play ${creator}'s video at ${ts}`
        : `Play ${creator}'s video`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-umami-event="play"
        data-umami-event-platform={platform}
        className="group flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-step)] bg-ink px-4 text-center font-semibold text-paper"
      >
        <span
          aria-hidden="true"
          className="enamel grid size-16 place-items-center bg-accent transition-transform duration-200 ease-out group-hover:scale-105"
        >
          <svg width="22" height="22" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3.5 1.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L4.4 1.3a.6.6 0 0 0-.9.5Z" />
          </svg>
        </span>
        <span>{label}</span>
      </button>
    );
  }

  const src =
    platform === "instagram"
      ? `https://www.instagram.com/reel/${encodeURIComponent(externalId)}/embed`
      : `${youtubeEmbedUrl(externalId, tsSeconds)}${tsSeconds ? "&" : "?"}autoplay=1`;
  return (
    <iframe
      ref={frame}
      src={src}
      title={label}
      className={`w-full rounded-[var(--radius-step)] ${
        platform === "instagram" ? "aspect-[9/16] max-h-[640px]" : "aspect-video"
      }`}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
