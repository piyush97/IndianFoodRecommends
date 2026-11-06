import { describe, expect, it } from "vitest";
import { directionsUrl, formatTs, sourceUrl, youtubeEmbedUrl } from "./links";

describe("directionsUrl", () => {
  it("is null without coordinates", () => {
    expect(directionsUrl(null, 77)).toBeNull();
    expect(directionsUrl(28.6, null)).toBeNull();
  });

  it("builds a Google Maps directions link", () => {
    expect(directionsUrl(28.6, 77.2)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=28.6,77.2",
    );
  });
});

describe("youtubeEmbedUrl", () => {
  it("starts at the timestamp on the privacy domain", () => {
    expect(youtubeEmbedUrl("abc", 252)).toBe(
      "https://www.youtube-nocookie.com/embed/abc?start=252",
    );
  });

  it("omits start without a timestamp", () => {
    expect(youtubeEmbedUrl("abc", null)).toBe("https://www.youtube-nocookie.com/embed/abc");
  });
});

describe("sourceUrl", () => {
  it("links to the YouTube moment", () => {
    expect(sourceUrl("youtube", "abc", 252)).toBe("https://www.youtube.com/watch?v=abc&t=252s");
  });

  it("links to the Instagram reel", () => {
    expect(sourceUrl("instagram", "C9x", null)).toBe("https://www.instagram.com/reel/C9x/");
  });
});

describe("formatTs", () => {
  it.each([
    [252, "4:12"],
    [3725, "1:02:05"],
    [5, "0:05"],
  ])("%i seconds is %s", (s, out) => {
    expect(formatTs(s)).toBe(out);
  });

  it("is null without a timestamp", () => {
    expect(formatTs(null)).toBeNull();
  });
});
