export type Platform = "youtube" | "instagram";

export function directionsUrl(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
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
