import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkBotId = vi.fn();
const createReport = vi.fn();
vi.mock("botid/server", () => ({ checkBotId }));
vi.mock("../../../db", () => ({ db: {} }));
vi.mock("../../../lib/report", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/report")>();
  return { ...actual, createReport };
});

const { POST } = await import("./route");

function req(body: unknown) {
  return new Request("http://x/api/report", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/report", () => {
  beforeEach(() => {
    process.env.REPORT_SALT = "salt";
    process.env.VERCEL = "1";
    checkBotId.mockReset();
    createReport.mockReset();
  });
  afterEach(() => {
    delete process.env.REPORT_SALT;
    delete process.env.VERCEL;
  });

  it("blocks bots before touching the database", async () => {
    checkBotId.mockResolvedValue({ isBot: true });
    expect((await POST(req({ placeId: 1, kind: "closed" }))).status).toBe(403);
    expect(createReport).not.toHaveBeenCalled();
  });

  it("skips BotID off Vercel, where it cannot classify", async () => {
    delete process.env.VERCEL;
    createReport.mockResolvedValue({ ok: true });
    expect((await POST(req({ placeId: 1, kind: "closed" }))).status).toBe(201);
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it("rejects bad JSON", async () => {
    checkBotId.mockResolvedValue({ isBot: false });
    expect((await POST(req("nope"))).status).toBe(400);
  });

  it("passes a hashed IP, never the raw one", async () => {
    checkBotId.mockResolvedValue({ isBot: false });
    createReport.mockResolvedValue({ ok: true });
    const res = await POST(req({ placeId: 1, kind: "closed" }));
    expect(res.status).toBe(201);
    const ipHash = createReport.mock.calls[0][2] as string;
    expect(ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ipHash).not.toContain("203.0.113.9");
  });
});
