"use client";

import { toggle, useEatList } from "../lib/eat-list";
import { track } from "../lib/track";

/** Device-only save: the list lives in localStorage, nothing is sent anywhere. */
export function SaveButton({ slug, placeName }: { slug: string; placeName: string }) {
  const saved = useEatList().includes(slug);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => track(toggle(slug) ? "save" : "unsave", { place: slug })}
      className="btn btn-line min-h-11"
    >
      {saved ? "Saved" : "Save"}
      <span className="sr-only"> {placeName} to my list</span>
    </button>
  );
}
