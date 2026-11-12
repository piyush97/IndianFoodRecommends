import { describe, expect, it } from "vitest";
import { compareCards, rankScore, recencyBonus } from "./rank";

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

describe("compareCards", () => {
  const card = (over: Partial<Parameters<typeof compareCards>[0]> = {}) => ({
    score: 10,
    videos: 1,
    dishes: ["Momos"],
    approx: false,
    pickedOn: "2026-10-01",
    placeName: "Mid",
    ...over,
  });
  const order = (...cards: ReturnType<typeof card>[]) =>
    cards.sort(compareCards).map((c) => c.placeName);

  it("puts the higher score first, whatever the evidence below it", () => {
    const strong = card({ placeName: "Zed", score: 20 });
    const weak = card({
      placeName: "Alef",
      score: 15,
      videos: 9,
      dishes: ["a", "b", "c"],
      pickedOn: "2026-11-05",
    });
    expect(order(weak, strong)).toEqual(["Zed", "Alef"]);
  });

  it("keeps the recency bonus working within one creator count", () => {
    const fresh = card({ placeName: "Zed", score: rankScore(1, daysAgo(10), now) });
    const stale = card({ placeName: "Alef", score: rankScore(1, daysAgo(400), now) });
    expect(order(stale, fresh)).toEqual(["Zed", "Alef"]);
  });

  it("puts two videos before one at the same score", () => {
    expect(order(card({ placeName: "Alef" }), card({ placeName: "Zed", videos: 2 }))).toEqual([
      "Zed",
      "Alef",
    ]);
  });

  it("puts more dishes before fewer when videos tie", () => {
    const two = card({ placeName: "Zed", dishes: ["Momos", "Kachori"] });
    expect(order(card({ placeName: "Alef" }), two)).toEqual(["Zed", "Alef"]);
  });

  it("puts an exact pin before an approximate one when the rest ties", () => {
    const approx = card({ placeName: "Alef", approx: true });
    expect(order(approx, card({ placeName: "Zed" }))).toEqual(["Zed", "Alef"]);
  });

  it("does not let an exact pin beat more videos or dishes", () => {
    const approx = card({ placeName: "Zed", approx: true, videos: 2 });
    expect(order(card({ placeName: "Alef" }), approx)).toEqual(["Zed", "Alef"]);
  });

  it("puts the newest pick first when everything above ties", () => {
    const newer = card({ placeName: "Zed", pickedOn: "2026-10-20" });
    expect(order(card({ placeName: "Alef" }), newer)).toEqual(["Zed", "Alef"]);
  });

  it("falls back to the place name last", () => {
    expect(order(card({ placeName: "Zed" }), card({ placeName: "Alef" }))).toEqual(["Alef", "Zed"]);
  });

  it("is antisymmetric, and 0 for identical input", () => {
    const cards = [
      card(),
      card({ placeName: "B", score: 11 }),
      card({ placeName: "C", videos: 2 }),
      card({ placeName: "D", dishes: [] }),
      card({ placeName: "E", approx: true }),
      card({ placeName: "F", pickedOn: "2026-09-01" }),
    ];
    for (const a of cards)
      for (const b of cards)
        expect(Math.sign(compareCards(a, b))).toBe(-Math.sign(compareCards(b, a)) || 0);
    expect(compareCards(card(), card())).toBe(0);
  });
});
