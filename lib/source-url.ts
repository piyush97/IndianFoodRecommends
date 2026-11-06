export type SourceRef = { platform: "youtube" | "instagram"; externalId: string };

const YT_ID = /^[0-9A-Za-z_-]{11}$/;
const IG_CODE = /^[0-9A-Za-z_-]{5,40}$/;

/** Accepts only YouTube and Instagram URLs; returns the id we store, never the URL. */
export function parseSourceUrl(raw: string): SourceRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  let id: string | null = null;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (host === "youtube.com") {
    id =
      parts[0] === "shorts" || parts[0] === "embed"
        ? (parts[1] ?? null)
        : url.searchParams.get("v");
  }
  if (id !== null) return YT_ID.test(id) ? { platform: "youtube", externalId: id } : null;

  if (host === "instagram.com" && (parts[0] === "reel" || parts[0] === "p") && parts[1]) {
    return IG_CODE.test(parts[1]) ? { platform: "instagram", externalId: parts[1] } : null;
  }
  return null;
}
