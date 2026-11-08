"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { MapPoint } from "./map-points";

const HEIGHT = 420;

/** Client-only map; keeps MapLibre out of the server bundle and initial HTML. */
export const PlaceMapLazy = dynamic(() => import("./PlaceMap"), {
  ssr: false,
  loading: () => (
    <p style={{ height: HEIGHT }} className="text-muted">
      Loading map…
    </p>
  ),
});

/**
 * MapLibre costs seconds of main-thread time on phones, so it loads only when
 * asked. The reserved box keeps the footer from jumping (CLS).
 */
export function MapOnDemand({ points, citySlug }: { points: MapPoint[]; citySlug: string }) {
  const [show, setShow] = useState(false);
  if (show) return <PlaceMapLazy points={points} citySlug={citySlug} height={HEIGHT} />;
  return (
    <button type="button" onClick={() => setShow(true)} className="btn btn-line self-start">
      Show map
    </button>
  );
}
