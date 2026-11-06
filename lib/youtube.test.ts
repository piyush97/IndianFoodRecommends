import { describe, expect, it, vi } from "vitest";
import { feedUrl, listUploads, parseFeed, type YtFetch } from "./youtube";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Aayush Sapra</title>
 <entry>
  <id>yt:video:newer1</id>
  <yt:videoId>newer1</yt:videoId>
  <title>Delhi Food Tour &amp; More</title>
  <published>2026-11-05T10:00:00+00:00</published>
  <media:group>
   <media:title>Delhi Food Tour &amp; More</media:title>
   <media:description>Chache Di Hatti chole bhature at 04:12
Second line</media:description>
  </media:group>
 </entry>
 <entry>
  <id>yt:video:older2</id>
  <yt:videoId>older2</yt:videoId>
  <title>Old video</title>
  <published>2026-10-01T10:00:00+00:00</published>
  <media:group>
   <media:title>Old video</media:title>
   <media:description>nothing</media:description>
  </media:group>
 </entry>
 <entry>
  <id>yt:video:novid</id>
  <title>Broken entry</title>
  <published>2026-11-01T10:00:00+00:00</published>
 </entry>
</feed>`;

function fetchReturning(body: string, status = 200): YtFetch {
  return vi.fn(async () => new Response(body, { status })) as unknown as YtFetch;
}

describe("feedUrl", () => {
  it("builds the public channel feed with no api key", () => {
    expect(feedUrl("UC2UWtuZR3kH-5C26HVMMB6A")).toBe(
      "https://www.youtube.com/feeds/videos.xml?channel_id=UC2UWtuZR3kH-5C26HVMMB6A",
    );
  });
});

describe("parseFeed", () => {
  it("reads id, date, title and description from each entry", () => {
    const uploads = parseFeed(FEED);
    expect(uploads).toHaveLength(2);
    expect(uploads[0]).toEqual({
      videoId: "newer1",
      publishedAt: new Date("2026-11-05T10:00:00Z"),
      title: "Delhi Food Tour & More",
      description: "Chache Di Hatti chole bhature at 04:12\nSecond line",
    });
  });

  it("skips entries without a video id", () => {
    expect(parseFeed(FEED).map((u) => u.videoId)).not.toContain("novid");
  });
});

describe("listUploads", () => {
  it("fetches the channel feed and drops videos older than since", async () => {
    const uploads = await listUploads("UC2UWtuZR3kH-5C26HVMMB6A", {
      since: new Date("2026-11-01T00:00:00Z"),
      fetchImpl: fetchReturning(FEED),
    });
    expect(uploads.map((u) => u.videoId)).toEqual(["newer1"]);
  });

  it("throws an error carrying the status on a non-2xx response", async () => {
    await expect(
      listUploads("UC2UWtuZR3kH-5C26HVMMB6A", { fetchImpl: fetchReturning("nope", 503) }),
    ).rejects.toThrow(/503/);
  });
});
