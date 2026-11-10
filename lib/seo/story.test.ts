import { describe, expect, it } from "vitest";
import type { PickCard } from "../public/queries";
import { storyCard, storyLines, storySize } from "./story";

const pick = (n: number, over: Partial<PickCard> = {}) =>
  ({ placeSlug: `p${n}`, placeName: `Place ${n}`, citySlug: "delhi", ...over }) as PickCard;

const data = (picks: PickCard[], name = "Bhooka Saand") => ({ creator: { name }, picks });

describe("storyLines", () => {
  it("titles with the creator name", () => {
    expect(storyLines(data([pick(1)])).title).toBe("Bhooka Saand's picks");
  });

  it("keeps at most five places, in order, with the city's display name", () => {
    const picks = [1, 2, 3, 4, 5, 6, 7].map((n) =>
      pick(n, { citySlug: n === 2 ? "bengaluru" : "delhi" }),
    );
    expect(storyLines(data(picks)).places).toEqual([
      { name: "Place 1", city: "Delhi" },
      { name: "Place 2", city: "Bengaluru" },
      { name: "Place 3", city: "Delhi" },
      { name: "Place 4", city: "Delhi" },
      { name: "Place 5", city: "Delhi" },
    ]);
  });

  it("truncates a long place name to 40 characters with an ellipsis", () => {
    const long = "A".repeat(60);
    const [first] = storyLines(data([pick(1, { placeName: long })])).places;
    expect(first.name).toBe(`${"A".repeat(39)}…`);
    expect(first.name).toHaveLength(40);
  });

  it("leaves a 40-character name alone", () => {
    const exact = "B".repeat(40);
    expect(storyLines(data([pick(1, { placeName: exact })])).places[0].name).toBe(exact);
  });

  it("truncates a long creator name in the title", () => {
    const { title } = storyLines(data([pick(1)], "C".repeat(60)));
    expect(title).toBe(`${"C".repeat(39)}…'s picks`);
  });

  it("falls back to the raw slug for a city it does not know", () => {
    expect(storyLines(data([pick(1, { citySlug: "atlantis" })])).places[0].city).toBe("atlantis");
  });
});

describe("storyCard", () => {
  it("is 1080x1920", () => {
    expect(storySize).toEqual({ width: 1080, height: 1920 });
  });

  it("renders a PNG", async () => {
    const res = await storyCard(storyLines(data([pick(1), pick(2)])));
    expect(res.headers.get("content-type")).toBe("image/png");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
});
