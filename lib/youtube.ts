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
  return since === undefined
    ? uploads
    : uploads.filter((u) => u.publishedAt.getTime() >= since);
}
