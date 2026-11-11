export type TrackEvent =
  | "search"
  | "near-me"
  | "save"
  | "unsave"
  | "list-share"
  | "list-open"
  | "list-save-all"
  | "report"
  | "share";

declare global {
  interface Window {
    umami?: { track(event: string, data?: Record<string, string>): void };
  }
}

/** Umami custom event. Never throws: analytics must not break the page, and is absent when blocked. */
export function track(event: TrackEvent, data?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(event, data);
  } catch {}
}

export function withUtm(url: string, medium: "native" | "copy" | "whatsapp"): string {
  const out = new URL(url);
  out.searchParams.set("utm_source", "share");
  out.searchParams.set("utm_medium", medium);
  // URLSearchParams escapes commas; keep `p=a,b` readable in a WhatsApp message.
  return out.toString().replaceAll("%2C", ",");
}

export function resultBucket(n: number): "0" | "1-5" | "6+" {
  return n === 0 ? "0" : n <= 5 ? "1-5" : "6+";
}
