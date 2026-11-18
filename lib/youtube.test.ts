import { describe, expect, it, vi } from "vitest";
import {
  channelAvatar,
  feedUrl,
  listUploads,
  parseFeed,
  parseYtDlp,
  type YtFetch,
} from "./youtube";

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

describe("channelAvatar", () => {
  const page = (url: string) =>
    `<html><head><meta property="og:image" content="${url}"><meta name="twitter:image" content="https://example.com/x.jpg"></head></html>`;

  it("returns the og:image when it comes from a YouTube image host", async () => {
    const url = "https://yt3.googleusercontent.com/avatar=s176-c-k-c0x00ffffff-no-rj";
    await expect(
      channelAvatar("UC2UWtuZR3kH-5C26HVMMB6A", fetchReturning(page(url))),
    ).resolves.toBe(url);
  });

  it("accepts the legacy ggpht host", async () => {
    const url = "https://yt3.ggpht.com/avatar";
    await expect(channelAvatar("UCabc", fetchReturning(page(url)))).resolves.toBe(url);
  });

  it("ignores an og:image from any other host", async () => {
    await expect(
      channelAvatar("UCabc", fetchReturning(page("https://evil.example/avatar.jpg"))),
    ).resolves.toBeUndefined();
  });

  it("returns undefined for a failed response, a missing tag or a thrown request", async () => {
    await expect(channelAvatar("UCabc", fetchReturning("", 404))).resolves.toBeUndefined();
    await expect(channelAvatar("UCabc", fetchReturning("<html></html>"))).resolves.toBeUndefined();
    const failing = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as YtFetch;
    await expect(channelAvatar("UCabc", failing)).resolves.toBeUndefined();
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

describe("parseYtDlp", () => {
  it("reads yt-dlp JSON lines and skips broken or dateless rows", () => {
    const lines = [
      JSON.stringify({
        id: "old1",
        upload_date: "20250504",
        title: "Biryani",
        description: "Dada Boudi 3:10",
      }),
      "not json",
      JSON.stringify({ id: "nodate", upload_date: null, title: "x", description: "" }),
      "",
    ].join("\n");
    expect(parseYtDlp(lines)).toEqual([
      {
        videoId: "old1",
        publishedAt: new Date("2025-05-04T00:00:00Z"),
        title: "Biryani",
        description: "Dada Boudi 3:10",
      },
    ]);
  });
});
