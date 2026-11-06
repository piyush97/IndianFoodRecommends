import { describe, expect, it } from "vitest";
import type { ExtractedPick } from "../llm/extract";
import { scoreExtraction } from "./eval";

function pick(place: string): ExtractedPick {
  return {
    place_name: place,
    locality: null,
    city: "Delhi",
    dishes: ["Chole Bhature"],
    timestamp_seconds: null,
    confidence: 0.9,
  };
}

const expected = [{ place: "Chache Di Hatti", dishes: ["Chole Bhature"] }];

describe("scoreExtraction", () => {
  it("scores a perfect match as 1 and 1", () => {
    const score = scoreExtraction(expected, [pick("Chache Di Hatti")]);
    expect(score).toMatchObject({ tp: 1, fp: 0, fn: 0, precision: 1, recall: 1 });
  });

  it("counts a hallucinated place as a false positive", () => {
    const score = scoreExtraction(expected, [pick("Chache Di Hatti"), pick("Karim's")]);
    expect(score.precision).toBe(0.5);
  });

  it("counts a missed place as a false negative", () => {
    const score = scoreExtraction(expected, []);
    expect(score.recall).toBe(0);
    expect(score.fn).toBe(1);
  });

  it("treats a spelling variant as a true positive", () => {
    const score = scoreExtraction(expected, [pick("Chachey di Hatti")]);
    expect(score.tp).toBe(1);
    expect(score.precision).toBe(1);
  });

  it("returns 1 and 1 when both sides are empty", () => {
    expect(scoreExtraction([], [])).toMatchObject({ precision: 1, recall: 1 });
  });
});
