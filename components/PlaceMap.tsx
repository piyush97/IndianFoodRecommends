"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import { ROUTE } from "./LidCode";
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
    // Keep the credit as the (i) button so it never covers pins; it opens on tap.
    map.once("load", () =>
      container.current
        ?.querySelector(".maplibregl-compact-show")
        ?.classList.remove("maplibregl-compact-show"),
    );

    const route = ROUTE[citySlug] ?? ROUTE.delhi;
    for (const p of points) {
      const link = document.createElement("a");
      link.href = `/${citySlug}/place/${p.slug}`;
      link.textContent = p.rank ? `${p.rank}. ${p.name}` : p.name;
      link.className = "font-medium underline";
      const body = document.createElement("div");
      body.append(link);
      if (p.approx) {
        const note = document.createElement("p");
        note.textContent = "Dashed pin: approximate location (neighbourhood)";
        body.append(note);
      }
      // A lid tile in the city's route colour, numbered like its row; dashed when approximate.
      const pin = document.createElement("span");
      pin.textContent = p.rank ? String(p.rank) : "";
      pin.className = "enamel type-lid grid size-8 place-items-center text-base";
      pin.style.background = p.approx ? "var(--color-paper)" : route.bg;
      pin.style.color = p.approx ? "var(--color-ink)" : route.fg;
      pin.setAttribute("aria-label", `${p.name}${p.approx ? ", approximate location" : ""}`);
      if (p.approx) pin.style.boxShadow = "none";
      if (p.approx) pin.style.border = `2px dashed ${route.bg}`;
      new maplibregl.Marker({ element: pin })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setDOMContent(body))
        .addTo(map);
    }

    if (points.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      for (const p of points) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, {
        padding: { top: 56, right: 72, bottom: 64, left: 48 },
        maxZoom: 15,
        duration: 0,
      });
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
      className="w-full overflow-hidden rounded-[var(--radius-step)] border border-line"
    />
  );
}
