"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";

// v6 resolves its worker from import.meta.url, which breaks once bundled.
maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
import { useEffect, useRef, useState } from "react";
import type { Bounds, MapFilter } from "../lib/public/spatial";
import { ROUTE } from "./LidCode";
import type { MapPoint } from "./map-points";

// OpenFreeMap: OSM vector tiles, no API key, no usage limit.
const STYLE = "https://tiles.openfreemap.org/styles/liberty";

// WebGL styles and canvas accept resolved colours, not CSS var() expressions.
function routeColors(city: string) {
  const route = ROUTE[city] ?? ROUTE.delhi;
  const style = getComputedStyle(document.documentElement);
  const resolve = (value: string) =>
    value.startsWith("var(") ? style.getPropertyValue(value.slice(4, -1)).trim() : value;
  return { bg: resolve(route.bg), fg: resolve(route.fg) };
}

export default function PlaceMap({
  points,
  citySlug,
  height = 420,
  onBounds,
  filter,
  heatmap = false,
}: {
  points: MapPoint[];
  citySlug: string;
  height?: number;
  onBounds?: (bounds: Bounds) => void;
  filter?: MapFilter;
  heatmap?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [initial] = useState(points);
  const [error, setError] = useState("");
  const [density, setDensity] = useState(false);
  const [densityNote, setDensityNote] = useState("");

  useEffect(() => {
    if (!container.current || !initial.length) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: [initial[0].lng, initial[0].lat],
      zoom: 13,
      renderWorldCopies: false,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    const moved = () => {
      const b = map.getBounds();
      onBounds?.([
        Math.max(-180, b.getWest()),
        Math.max(-90, b.getSouth()),
        Math.min(180, b.getEast()),
        Math.min(90, b.getNorth()),
      ]);
    };
    map.on("moveend", moved);
    map.on("error", (event) => {
      console.error("place map", event.error);
      setError("Map tiles could not load. Use the list below or switch to List.");
    });
    map.once("load", () =>
      container.current
        ?.querySelector(".maplibregl-compact-show")
        ?.classList.remove("maplibregl-compact-show"),
    );
    if (initial.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      for (const p of initial) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, {
        padding: { top: 56, right: 72, bottom: 64, left: 48 },
        maxZoom: 15,
        duration: 0,
      });
    }
    moved();
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [initial, citySlug, onBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const route = routeColors(citySlug);
    if (points.length > 300) {
      const render = () => {
        const params = new URLSearchParams({ city: citySlug });
        for (const [key, value] of Object.entries(filter ?? {})) if (value) params.set(key, value);
        map.addSource("picks", {
          type: "vector",
          tiles: [`${location.origin}/api/tiles/{z}/{x}/{y}?${params}`],
          maxzoom: 18,
        });
        for (const approx of [false, true]) {
          const canvas = document.createElement("canvas");
          canvas.width = 88;
          canvas.height = 88;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = approx ? "#f2eee5" : route.bg;
          ctx.strokeStyle = route.bg;
          ctx.lineWidth = 4;
          if (approx) ctx.setLineDash([8, 5]);
          ctx.beginPath();
          ctx.roundRect(2, 2, 84, 84, 8);
          ctx.fill();
          ctx.stroke();
          if (!map.hasImage(`pick-${approx}`))
            map.addImage(`pick-${approx}`, ctx.getImageData(0, 0, 88, 88), { pixelRatio: 2 });
        }
        map.addLayer({
          id: "pick-tiles",
          type: "symbol",
          source: "picks",
          "source-layer": "picks",
          layout: {
            "icon-image": ["concat", "pick-", ["to-string", ["get", "approx"]]],
            "text-field": [
              "to-string",
              [
                "coalesce",
                [
                  "get",
                  ["get", "slug"],
                  ["literal", Object.fromEntries(points.map((p) => [p.slug, p.rank ?? ""]))],
                ],
                "",
              ],
            ],
            "text-size": 16,
            "text-optional": true,
            "icon-allow-overlap": false,
            "text-allow-overlap": false,
          },
          paint: { "text-color": ["case", ["get", "approx"], "#1d1a16", route.fg] },
        });
      };
      if (map.isStyleLoaded()) render();
      else map.once("load", render);
      const popup = (event: maplibregl.MapMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ["pick-tiles"] })[0];
        if (!feature) return;
        const link = document.createElement("a");
        link.href = `/${citySlug}/place/${encodeURIComponent(String(feature.properties.slug))}`;
        link.textContent = String(feature.properties.name);
        link.className = "font-medium underline";
        const body = document.createElement("div");
        body.append(link);
        if (feature.properties.approx) {
          const note = document.createElement("p");
          note.textContent = "Dashed pin: approximate location (neighbourhood)";
          body.append(note);
        }
        new maplibregl.Popup().setLngLat(event.lngLat).setDOMContent(body).addTo(map);
      };
      map.on("click", "pick-tiles", popup);
      return () => {
        map.off("load", render);
        map.off("click", "pick-tiles", popup);
        if (mapRef.current !== map) return;
        if (map.getLayer("pick-tiles")) map.removeLayer("pick-tiles");
        if (map.getSource("picks")) map.removeSource("picks");
      };
    }
    const markers = points.map((p) => {
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
      const pin = document.createElement("button");
      pin.type = "button";
      pin.textContent = p.rank ? String(p.rank) : "";
      pin.className = "enamel type-lid grid size-11 place-items-center text-base";
      pin.style.background = p.approx ? "var(--color-paper)" : route.bg;
      pin.style.color = p.approx ? "var(--color-ink)" : route.fg;
      pin.setAttribute("aria-label", `${p.name}${p.approx ? ", approximate location" : ""}`);
      if (p.approx) {
        pin.style.boxShadow = "none";
        pin.style.border = `2px dashed ${route.bg}`;
      }
      return new maplibregl.Marker({ element: pin })
        .setLngLat([p.lng, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setDOMContent(body))
        .addTo(map);
    });
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [points, citySlug, filter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !density) return;
    const controller = new AbortController();
    let disposed = false;
    let render: (() => void) | undefined;
    fetch(`/api/heatmap?${new URLSearchParams({ city: citySlug })}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Food density is temporarily unavailable.");
        return res.json();
      })
      .then((data) => {
        if (disposed) return;
        if (!Array.isArray(data.features))
          throw new Error("Food density is temporarily unavailable.");
        setDensityNote(
          data.features.length
            ? "Darker cells contain more creator picks. Approximate pins may share an area centre."
            : "Food density is not available for this city yet.",
        );
        render = () => {
          if (disposed) return;
          map.addSource("density", { type: "geojson", data });
          map.addLayer(
            {
              id: "food-density",
              type: "fill",
              source: "density",
              paint: {
                "fill-color": routeColors(citySlug).bg,
                "fill-opacity": ["interpolate", ["linear"], ["get", "count"], 1, 0.15, 8, 0.6],
                "fill-outline-color": routeColors(citySlug).bg,
              },
            },
            map.getLayer("pick-tiles") ? "pick-tiles" : undefined,
          );
        };
        if (map.isStyleLoaded()) render();
        else map.once("load", render);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDensityNote(
            error instanceof Error ? error.message : "Food density is temporarily unavailable.",
          );
      });
    return () => {
      disposed = true;
      controller.abort();
      if (render) map.off("load", render);
      if (mapRef.current !== map) return;
      if (map.getLayer("food-density")) map.removeLayer("food-density");
      if (map.getSource("density")) map.removeSource("density");
    };
  }, [density, citySlug]);

  if (!initial.length)
    return <p className="text-muted">None of these places has a map location yet.</p>;
  return (
    <>
      {heatmap && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-line self-start"
            aria-pressed={density}
            onClick={() => {
              setDensityNote("");
              setDensity(!density);
            }}
          >
            {density ? "Hide food density" : "Show food density"}
          </button>
          {density && (
            <p role="status" className="text-sm text-muted">
              {densityNote || "Loading food density…"}
            </p>
          )}
        </div>
      )}
      <div
        ref={container}
        role="region"
        aria-label="Map of places. Arrow keys pan; plus and minus zoom. The list has the same places."
        style={{ height }}
        className="w-full overflow-hidden rounded-[var(--radius-step)] border border-line"
      />
      {error && (
        <p role="status" className="text-sm text-muted">
          {error}
        </p>
      )}
    </>
  );
}
