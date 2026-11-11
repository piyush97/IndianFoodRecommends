"use client";
import { useEffect } from "react";
import { resultBucket, track } from "../lib/track";

/** Fires one `search` event per query. The page is server-rendered, so this island does the tracking. */
export function TrackSearch({ query, total }: { query: string; total: number }) {
  useEffect(() => {
    track("search", { results: resultBucket(total) });
  }, [query, total]);
  return null;
}
