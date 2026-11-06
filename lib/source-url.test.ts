import { describe, expect, it } from "vitest";
import { parseSourceUrl } from "./source-url";

describe("parseSourceUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=bKLgzkCAF6Q&t=40s", "bKLgzkCAF6Q"],
    ["https://youtu.be/bKLgzkCAF6Q?si=x", "bKLgzkCAF6Q"],
    ["https://www.youtube.com/shorts/bKLgzkCAF6Q", "bKLgzkCAF6Q"],
    ["https://m.youtube.com/watch?v=bKLgzkCAF6Q", "bKLgzkCAF6Q"],
  ])("reads a YouTube id from %s", (url, id) => {
    expect(parseSourceUrl(url)).toEqual({ platform: "youtube", externalId: id });
  });

  it.each([
    ["https://www.instagram.com/reel/C9xYz123AbC/", "C9xYz123AbC"],
    ["https://instagram.com/p/C9xYz123AbC/?igsh=abc", "C9xYz123AbC"],
  ])("reads an Instagram shortcode from %s", (url, id) => {
    expect(parseSourceUrl(url)).toEqual({ platform: "instagram", externalId: id });
  });

  it.each([
    "https://example.com/watch?v=bKLgzkCAF6Q",
    "not a url",
    "https://youtube.com/watch?v=bad",
  ])("rejects %s", (url) => {
    expect(parseSourceUrl(url)).toBeNull();
  });
});
