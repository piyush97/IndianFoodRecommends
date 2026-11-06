"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { MapPoint } from "./map-points";

// OpenFreeMap: OSM vector tiles, no API key, no usage limit.
const STYLE = "https://tiles.openfreemap.org/styles/liberty";

export default function PlaceMap({
  points,
  citySlug,
  height = 420,
}: {
  points: MapPoint[];
  citySlug: string;
  height?: number;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || points.length === 0) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: [points[0].lng, points[0].lat],
      zoom: 13,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));

    for (const p of points) {
      const link = document.createElement("a");
      link.href = `/${citySlug}/place/${p.slug}`;
      link.textContent = p.name;
      link.className = "font-medium underline";
      const body = document.createElement("div");
      body.append(link);
      if (p.approx) {
        const note = document.createElement("p");
        note.textContent = "Approximate location (neighbourhood)";
        body.append(note);
      }
      new maplibregl.Marker({ color: p.approx ? "#6b635c" : "#9a3412" })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setDOMContent(body))
        .addTo(map);
    }

    if (points.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    }
    return () => map.remove();
  }, [points, citySlug]);

  if (points.length === 0) {
    return <p className="text-muted">None of these places has a map location yet.</p>;
  }
  return (
    <div
      ref={container}
      role="region"
      aria-label="Map of places. The list tab has the same places."
      style={{ height }}
      className="w-full overflow-hidden rounded-[var(--radius-card)] border border-line"
    />
  );
}
