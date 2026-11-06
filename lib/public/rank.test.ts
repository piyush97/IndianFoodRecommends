import { describe, expect, it } from "vitest";
import { rankScore, recencyBonus } from "./rank";

const now = new Date("2026-11-06T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("recencyBonus", () => {
  it.each([
    [10, 5],
    [60, 3],
    [200, 1],
    [400, 0],
  ])("%i days old gives %i", (days, bonus) => {
    expect(recencyBonus(daysAgo(days), now)).toBe(bonus);
  });
});

describe("rankScore", () => {
  it("weights distinct creators by 10 and adds recency", () => {
    expect(rankScore(3, daysAgo(10), now)).toBe(35);
  });
});
