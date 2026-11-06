import { describe, expect, it, vi } from "vitest";
import { ExtractionError, ExtractedPick, extractPicks, type ChatFn } from "./extract";

const validPick = {
  place_name: "Chache Di Hatti",
  locality: "Kamla Nagar",
  city: "Delhi",
  dishes: ["Chole Bhature"],
  timestamp_seconds: 252,
  confidence: 0.9,
};

function replyOf(items: unknown): string {
  return JSON.stringify({ items });
}

describe("extractPicks", () => {
  it("parses valid JSON into picks", async () => {
    const chat: ChatFn = async () => replyOf([validPick]);
    const picks = await extractPicks({ title: "t", description: "d" }, chat);
    expect(picks).toEqual([validPick]);
  });

  it("strips a markdown json fence", async () => {
    const chat: ChatFn = async () => "```json\n" + replyOf([validPick]) + "\n```";
    const picks = await extractPicks({ title: "t", description: "d" }, chat);
    expect(picks[0].place_name).toBe("Chache Di Hatti");
  });

  it("retries once when the first reply is prose", async () => {
    const chat = vi
      .fn<ChatFn>()
      .mockResolvedValueOnce("Sure! Here are the picks:")
      .mockResolvedValueOnce(replyOf([validPick]));
    const picks = await extractPicks({ title: "t", description: "d" }, chat);
    expect(picks).toHaveLength(1);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("throws ExtractionError after two invalid replies", async () => {
    const chat: ChatFn = async () => "not json";
    await expect(extractPicks({ title: "t", description: "d" }, chat)).rejects.toBeInstanceOf(
      ExtractionError,
    );
  });

  it("returns an empty list for no picks", async () => {
    const chat: ChatFn = async () => replyOf([]);
    await expect(extractPicks({ title: "t", description: "d" }, chat)).resolves.toEqual([]);
  });

  it("treats a pick without dishes as invalid and retries", async () => {
    const chat = vi
      .fn<ChatFn>()
      .mockResolvedValueOnce(replyOf([{ ...validPick, dishes: [] }]))
      .mockResolvedValueOnce(replyOf([validPick]));
    await expect(extractPicks({ title: "t", description: "d" }, chat)).resolves.toHaveLength(1);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("truncates the description to 6000 characters in the prompt", async () => {
    const description = "x".repeat(20_000);
    let prompts: string[] = [];
    const chat: ChatFn = async (messages) => {
      prompts = messages.map((m) => m.content);
      return replyOf([]);
    };
    await extractPicks({ title: "t", description }, chat);
    expect(prompts.join("\n")).toContain("x".repeat(6000));
    expect(prompts.join("\n")).not.toContain("x".repeat(6001));
  });
});

describe("ExtractedPick type", () => {
  it("is exported for consumers", () => {
    const pick: ExtractedPick = validPick;
    expect(pick.city).toBe("Delhi");
  });
});
