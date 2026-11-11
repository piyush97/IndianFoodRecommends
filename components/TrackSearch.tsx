"use client";
import { useEffect, useRef } from "react";
import { resultBucket, track } from "../lib/track";

/**
 * Fires one `search` event per query. The page is server-rendered, so this island does the
 * tracking. A diet filter changes the total for the same query; that is not a new search.
 */
export function TrackSearch({ query, total }: { query: string; total: number }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === query) return;
    sent.current = query;
    track("search", { results: resultBucket(total) });
  }, [query, total]);
  return null;
}
