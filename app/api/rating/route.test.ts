import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { googleRating, takeToken, clientKey } = vi.hoisted(() => ({
  googleRating: vi.fn(),
  takeToken: vi.fn(),
  clientKey: vi.fn(() => "rating:ip"),
}));

vi.mock("../../../db", () => ({ db: {} }));
vi.mock("../../../lib/google-rating", () => ({ googleRating }));
vi.mock("../../../lib/rate-limit", () => ({ clientKey, takeToken }));

const { GET } = await import("./route");

const req = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { headers: { "user-agent": "Mozilla/5.0", ...headers } });

describe("GET /api/rating", () => {
  beforeEach(() => {
    googleRating.mockReset();
    takeToken.mockReset();
  });

  it("rejects a bad slug without spending a token or a Google call", async () => {
    const res = await GET(req("http://x/api/rating?place=Bad%20Slug"));
    expect(res.status).toBe(400);
    expect(takeToken).not.toHaveBeenCalled();
    expect(googleRating).not.toHaveBeenCalled();
  });

  it("answers 204 for bots before any limit or Google call", async () => {
    const res = await GET(req("http://x/api/rating?place=a-b", { "user-agent": "Googlebot" }));
    expect(res.status).toBe(204);
    expect(takeToken).not.toHaveBeenCalled();
    expect(googleRating).not.toHaveBeenCalled();
  });

  it("answers 204 with retry-after when the bucket is empty", async () => {
    takeToken.mockResolvedValue({ ok: false, retryAfterMs: 4000 });
    const res = await GET(req("http://x/api/rating?place=a-b"));
    expect(res.status).toBe(204);
    expect(res.headers.get("retry-after")).toBe("4");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(googleRating).not.toHaveBeenCalled();
  });

  it("returns the rating uncached when a token is available", async () => {
    takeToken.mockResolvedValue({ ok: true, retryAfterMs: 0 });
    googleRating.mockResolvedValue({
      rating: 4.5,
      count: 12,
      url: "https://maps.google.com/?cid=1",
    });
    const res = await GET(req("http://x/api/rating?place=a-b"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({
      rating: 4.5,
      count: 12,
      url: "https://maps.google.com/?cid=1",
    });
    expect(takeToken).toHaveBeenCalledWith({}, "rating:ip", {
      capacity: 30,
      refillPerSecond: 30 / 60,
    });
  });
});
