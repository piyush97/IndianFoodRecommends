import { describe, expect, it, vi } from "vitest";
import type { ExtractedPick } from "./llm/extract";
import { classifyVideo, gatedExtract, shouldExtract, type VideoVerdict } from "./jev";

const delhi: VideoVerdict = {
  namesPlace: 0.9,
  city: "covered",
  cityConfidence: 0.95,
  negative: 0.05,
};
const pick: ExtractedPick = {
  place_name: "Chache Di Hatti",
  locality: null,
  city: "Delhi",
  dishes: ["Chole Bhature"],
  timestamp_seconds: null,
  confidence: 0.9,
};
const video = { title: "t", description: "d" };

describe("shouldExtract", () => {
  it("extracts a Delhi food video", () => {
    expect(shouldExtract(delhi).extract).toBe(true);
  });

  it("skips a video confidently outside our cities", () => {
    expect(shouldExtract({ ...delhi, city: "other", cityConfidence: 0.92 })).toEqual({
      extract: false,
      reason: "not-covered",
    });
  });

  it("still extracts when the other-city call is unsure", () => {
    expect(shouldExtract({ ...delhi, city: "other", cityConfidence: 0.6 }).extract).toBe(true);
  });

  it("still extracts when the city is unknown", () => {
    expect(shouldExtract({ ...delhi, city: "unknown", cityConfidence: 0.99 }).extract).toBe(true);
  });

  it("skips a video that names no food place", () => {
    expect(shouldExtract({ ...delhi, namesPlace: 0.03 })).toEqual({
      extract: false,
      reason: "no-place",
    });
  });

  it("skips a video that warns against places", () => {
    expect(shouldExtract({ ...delhi, negative: 0.9 })).toEqual({
      extract: false,
      reason: "negative",
    });
  });
});

describe("gatedExtract", () => {
  it("does not call the LLM when Jev skips the video", async () => {
    const extract = vi.fn(async () => [pick]);
    const run = gatedExtract(
      async () => ({ ...delhi, city: "other", cityConfidence: 0.95 }),
      extract,
    );
    await expect(run(video)).resolves.toEqual([]);
    expect(extract).not.toHaveBeenCalled();
  });

  it("calls the LLM when Jev passes the video", async () => {
    const extract = vi.fn(async () => [pick]);
    const run = gatedExtract(async () => delhi, extract);
    await expect(run(video)).resolves.toEqual([pick]);
  });

  it("falls back to the LLM when Jev fails", async () => {
    const extract = vi.fn(async () => [pick]);
    const run = gatedExtract(async () => {
      throw new Error("jev down");
    }, extract);
    await expect(run(video)).resolves.toEqual([pick]);
  });
});

describe("classifyVideo", () => {
  it("maps Jev answers into a verdict and sends the key as a bearer token", async () => {
    let auth: string | null = null;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      auth = new Headers(init?.headers).get("authorization");
      return new Response(
        JSON.stringify({
          answers: {
            names_place: { type: "noul", noul: 0.8 },
            negative: { type: "noul", noul: 0.1 },
            city: { type: "choice", choice: "other", confidence: 0.92 },
          },
        }),
      );
    }) as typeof fetch;
    await expect(classifyVideo(video, { apiKey: "k", fetchImpl })).resolves.toEqual({
      namesPlace: 0.8,
      negative: 0.1,
      city: "other",
      cityConfidence: 0.92,
    });
    expect(auth).toBe("Bearer k");
  });

  it("throws on a non-2xx response without leaking the key", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 401 })) as typeof fetch;
    const error = await classifyVideo(video, { apiKey: "secret-key", fetchImpl }).catch((e) => e);
    expect(String(error)).toMatch(/401/);
    expect(String(error)).not.toContain("secret-key");
  });
});

describe("classifyVideo validation", () => {
  const good = {
    names_place: { noul: 0.8 },
    negative: { noul: 0.1 },
    city: { choice: "other", confidence: 0.92 },
  };
  const fetchFor = (over: object = {}) =>
    (async () => new Response(JSON.stringify({ answers: { ...good, ...over } }))) as typeof fetch;

  const malformed: Array<[string, object]> = [
    ["missing noul", { names_place: {} }],
    ["string score", { negative: { noul: "0.1" } }],
    ["score above one", { names_place: { noul: 1.2 } }],
    ["unknown city choice", { city: { choice: "delhi", confidence: 0.9 } }],
    ["missing city confidence", { city: { choice: "other" } }],
  ];

  it.each(malformed)("rejects malformed answers: %s", async (_name, over) => {
    await expect(
      classifyVideo(video, { apiKey: "k", fetchImpl: fetchFor(over) }),
    ).rejects.toThrow();
  });
});
