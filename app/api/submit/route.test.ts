import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkBotId = vi.fn();
const createSubmission = vi.fn();
vi.mock("botid/server", () => ({ checkBotId }));
vi.mock("../../../lib/submit", () => ({ createSubmission }));
vi.mock("../../../db", () => ({ db: {} }));

const { POST } = await import("./route");

function req(body: unknown) {
  return new Request("http://x/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/submit", () => {
  beforeEach(() => {
    process.env.REPORT_SALT = "salt";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    checkBotId.mockReset();
    createSubmission.mockReset();
  });
  afterEach(() => {
    delete process.env.REPORT_SALT;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  });

  it("blocks bots before touching the database", async () => {
    checkBotId.mockResolvedValue({ isBot: true });
    expect((await POST(req({ url: "x" }))).status).toBe(403);
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("skips BotID off Vercel, where it cannot classify", async () => {
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    createSubmission.mockResolvedValue({ ok: true });
    expect((await POST(req({ url: "u" }))).status).toBe(201);
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it("rejects bad JSON", async () => {
    checkBotId.mockResolvedValue({ isBot: false });
    expect((await POST(req("nope"))).status).toBe(400);
  });

  it("passes a hashed IP, never the raw one", async () => {
    checkBotId.mockResolvedValue({ isBot: false });
    createSubmission.mockResolvedValue({ ok: true });
    const res = await POST(req({ url: "u" }));
    expect(res.status).toBe(201);
    const ipHash = createSubmission.mock.calls[0][2] as string;
    expect(ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ipHash).not.toContain("203.0.113.5");
  });

  it("maps a rate limit to 429", async () => {
    checkBotId.mockResolvedValue({ isBot: false });
    createSubmission.mockResolvedValue({ ok: false, status: 429 });
    expect((await POST(req({ url: "u" }))).status).toBe(429);
  });
});
