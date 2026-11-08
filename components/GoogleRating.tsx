"use client";
import { useEffect, useState } from "react";
import type { GoogleRating as Rating } from "../lib/google-rating";

/** Loads the live Google rating after the page; shows nothing when there is none. */
export function GoogleRating({ placeSlug }: { placeSlug: string }) {
  const [rating, setRating] = useState<Rating | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/rating?place=${encodeURIComponent(placeSlug)}`)
      .then((res) => (res.status === 200 ? (res.json() as Promise<Rating>) : null))
      .then((r) => live && setRating(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [placeSlug]);

  if (!rating) return null;
  const count = rating.count.toLocaleString("en-IN");
  return (
    <p className="text-sm">
      <a
        href={rating.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-ink underline"
        data-umami-event="google-rating"
      >
        <span aria-hidden="true">★ </span>
        {rating.rating.toFixed(1)} out of 5 on Google Maps
        <span className="sr-only">, opens Google Maps</span>
      </a>{" "}
      <span className="text-muted">
        from {count} {rating.count === 1 ? "review" : "reviews"}
      </span>
    </p>
  );
}
