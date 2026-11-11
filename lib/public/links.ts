export type Platform = "youtube" | "instagram";

/** "Mar 2026" from a YYYY-MM-DD date or an ISO timestamp. */
export function monthYear(date: string): string {
  return new Date(date.length === 10 ? `${date}T00:00:00Z` : date).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Coordinates only for an exact pin; otherwise Google resolves the shop by name. */
export function directionsUrl(p: {
  name: string;
  locality: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  approx: boolean;
}): string {
  const exact = !p.approx && p.lat !== null && p.lng !== null;
  const destination = exact
    ? `${p.lat},${p.lng}`
    : encodeURIComponent([p.name, p.locality, p.city].filter(Boolean).join(", "));
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

const q = (s: string) => encodeURIComponent(s);

/** Google Maps search for the shop by name; exact when we hold its Google place ID. */
export function googleMapsUrl(name: string, where: string, placeId?: string | null): string {
  const base = `https://www.google.com/maps/search/?api=1&query=${q(`${name}, ${where}`)}`;
  return placeId ? `${base}&query_place_id=${q(placeId)}` : base;
}

/** Zomato has no search URL, so this is a Google search limited to zomato.com. */
export function zomatoUrl(name: string, city: string): string {
  return `https://www.google.com/search?q=${q(`${name} ${city} site:zomato.com`)}`;
}

/** Swiggy's own search; Swiggy asks for a delivery location if it has none. */
export function swiggyUrl(name: string): string {
  return `https://www.swiggy.com/search?query=${q(name)}`;
}

export function youtubeEmbedUrl(videoId: string, ts: number | null): string {
  const base = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
  return ts ? `${base}?start=${ts}` : base;
}

export function sourceUrl(platform: Platform, id: string, ts: number | null): string {
  if (platform === "instagram") return `https://www.instagram.com/reel/${encodeURIComponent(id)}/`;
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  return ts ? `${url}&t=${ts}s` : url;
}

export function formatTs(seconds: number | null): string | null {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
/** Up to five stops keeps the URL usable in Google Maps mobile browsers. */
export function walkDirections(stops: { lat: number | null; lng: number | null }[]): string | null {
  if (
    stops.length < 2 ||
    stops.length > 5 ||
    stops.some(
      (p) =>
        p.lat === null ||
        p.lng === null ||
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lng) ||
        Math.abs(p.lat) > 90 ||
        Math.abs(p.lng) > 180,
    )
  )
    return null;
  const points = stops.map((p) => `${p.lat},${p.lng}`);
  const query = new URLSearchParams({
    api: "1",
    travelmode: "walking",
    origin: points[0],
    destination: points[points.length - 1],
  });
  if (points.length > 2) query.set("waypoints", points.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${query}`;
}
