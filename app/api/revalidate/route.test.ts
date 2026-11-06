import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));

const { POST } = await import("./route");
const { notifyRevalidate } = await import("../../../lib/revalidate-client");

function req(body: unknown, auth?: string) {
  return new Request("http://x/api/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    process.env.REVALIDATE_SECRET = "s3cret";
    revalidateTag.mockClear();
  });
  afterEach(() => {
    delete process.env.REVALIDATE_SECRET;
  });

  it("rejects a missing or wrong secret", async () => {
    expect((await POST(req({ tags: ["public"] }))).status).toBe(401);
    expect((await POST(req({ tags: ["public"] }, "Bearer nope"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects malformed tags", async () => {
    expect((await POST(req({ tags: ["place:../x"] }, "Bearer s3cret"))).status).toBe(400);
    expect((await POST(req("nope", "Bearer s3cret"))).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates each valid tag with the max profile", async () => {
    const res = await POST(req({ tags: ["public", "place:chache-di-hatti"] }, "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([
      ["public", "max"],
      ["place:chache-di-hatti", "max"],
    ]);
  });

  it("is unavailable when no secret is configured", async () => {
    delete process.env.REVALIDATE_SECRET;
    expect((await POST(req({ tags: ["public"] }, "Bearer "))).status).toBe(503);
  });
});

describe("notifyRevalidate", () => {
  it("returns false instead of throwing when the site errors", async () => {
    const fetchImpl = (async () => new Response("x", { status: 500 })) as typeof fetch;
    await expect(
      notifyRevalidate(["public"], { url: "http://x", secret: "s", fetchImpl }),
    ).resolves.toBe(false);
  });

  it("returns false when not configured", async () => {
    await expect(notifyRevalidate(["public"], { url: "", secret: "" })).resolves.toBe(false);
  });

  it("posts tags with the bearer secret", async () => {
    let seen: { url: string; auth: string | null; body: string } | null = null;
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      seen = {
        url: String(url),
        auth: new Headers(init?.headers).get("authorization"),
        body: String(init?.body),
      };
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await expect(
      notifyRevalidate(["public"], { url: "https://site.test/", secret: "k", fetchImpl }),
    ).resolves.toBe(true);
    expect(seen).toEqual({
      url: "https://site.test/api/revalidate",
      auth: "Bearer k",
      body: JSON.stringify({ tags: ["public"] }),
    });
  });
});
