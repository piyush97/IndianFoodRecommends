export type YtFetch = typeof fetch;

export type Upload = {
  videoId: string;
  publishedAt: Date;
  title: string;
  description: string;
};

const ENTRIES = /<entry>([\s\S]*?)<\/entry>/g;

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tag(entry: string, name: string): string | null {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(entry);
  return m ? decodeEntities(m[1]).trim() : null;
}

/** Public channel feed. No API key, no quota, last 15 uploads. */
export function feedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

export function parseFeed(xml: string): Upload[] {
  const uploads: Upload[] = [];
  for (const [, entry] of xml.matchAll(ENTRIES)) {
    const videoId = tag(entry, "yt:videoId");
    const published = tag(entry, "published");
    if (!videoId || !published) continue;
    uploads.push({
      videoId,
      publishedAt: new Date(published),
      title: tag(entry, "media:title") ?? tag(entry, "title") ?? "",
      description: tag(entry, "media:description") ?? "",
    });
  }
  return uploads;
}

export async function listUploads(
  channelId: string,
  opts: { since?: Date; fetchImpl?: YtFetch } = {},
): Promise<Upload[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(feedUrl(channelId));
  if (!res.ok) throw new Error(`YouTube feed request failed with status ${res.status}`);
  const uploads = parseFeed(await res.text());
  const since = opts.since?.getTime();
  return since === undefined ? uploads : uploads.filter((u) => u.publishedAt.getTime() >= since);
}

/** yt-dlp `--print "%(.{id,upload_date,title,description})j"` output, one JSON object per line. */
export function parseYtDlp(out: string): Upload[] {
  const uploads: Upload[] = [];
  for (const line of out.split("\n")) {
    let v: { id?: string; upload_date?: string | null; title?: string; description?: string };
    try {
      v = JSON.parse(line);
    } catch {
      continue;
    }
    const d = v.upload_date;
    if (!v.id || !d || !/^\d{8}$/.test(d)) continue;
    uploads.push({
      videoId: v.id,
      publishedAt: new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}T00:00:00Z`),
      title: v.title ?? "",
      description: v.description ?? "",
    });
  }
  return uploads;
}

/**
 * A channel's latest `limit` uploads with full descriptions, past the feed's 15.
 * Needs the yt-dlp binary (YTDLP_BIN, default `yt-dlp`); used only by the backfill.
 */
export async function listArchive(channelId: string, limit: number): Promise<Upload[]> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout } = await promisify(execFile)(
    process.env.YTDLP_BIN ?? "yt-dlp",
    [
      "--skip-download",
      "--ignore-errors",
      "--no-warnings",
      "--playlist-end",
      String(limit),
      "--print",
      "%(.{id,upload_date,title,description})j",
      `https://www.youtube.com/channel/${channelId}/videos`,
    ],
    { maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60 * 1000 },
  ).catch((error: { stdout?: string }) => {
    // --ignore-errors still exits non-zero when a single video fails; keep what was printed.
    if (error.stdout) return { stdout: error.stdout };
    throw error;
  });
  return parseYtDlp(stdout);
}

/** The feed, or yt-dlp's latest 15 when the feed is down (YouTube RSS returns 404 for days at a time). */
export async function listUploadsWithFallback(
  channelId: string,
  opts: { since?: Date } = {},
): Promise<Upload[]> {
  try {
    return await listUploads(channelId, opts);
  } catch (error) {
    if (!process.env.YTDLP_BIN) throw error;
    const since = opts.since?.getTime() ?? 0;
    return (await listArchive(channelId, 15)).filter((u) => u.publishedAt.getTime() >= since);
  }
}
