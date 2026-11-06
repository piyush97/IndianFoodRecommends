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
        className="flex aspect-video w-full items-center justify-center rounded-[var(--radius-card)] border border-line bg-accent-soft px-4 text-center font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true" className="mr-2">
          ▶
        </span>
        {label}
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
      className={`w-full rounded-[var(--radius-card)] border border-line ${
        platform === "instagram" ? "aspect-[9/16] max-h-[640px]" : "aspect-video"
      }`}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
