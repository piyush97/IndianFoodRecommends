"use client";

import dynamic from "next/dynamic";

/** Client-only map; keeps MapLibre out of the server bundle and initial HTML. */
export const PlaceMapLazy = dynamic(() => import("./PlaceMap"), {
  ssr: false,
  loading: () => <p className="text-muted">Loading map…</p>,
});
