import { describe, expect, it } from "vitest";
import type { ExtractedPick } from "./llm/extract";
import { decidePick, type PickCheck } from "./auto-review";

const pick: ExtractedPick = {
  place_name: "Chache Di Hatti",
  locality: "Kamla Nagar",
  city: "Delhi",
  dishes: ["Chole Bhature"],
  timestamp_seconds: null,
  confidence: 0.8,
};
const good: PickCheck = { grounded: 0.9, isVenue: 0.9, recommends: 0.85, inDelhi: 0.9 };

describe("decidePick", () => {
  it("approves a grounded, positive Delhi pick", () => {
    expect(decidePick(pick, good)).toEqual({ approve: true });
  });

  it("rejects a pick whose stated city is not Delhi", () => {
    expect(decidePick({ ...pick, city: "Kolkata" }, good)).toEqual({
      approve: false,
      reason: "not-delhi",
    });
  });

  it("accepts New Delhi and NCR spellings", () => {
    expect(decidePick({ ...pick, city: "New Delhi" }, good).approve).toBe(true);
    expect(decidePick({ ...pick, city: "Gurgaon" }, good).approve).toBe(true);
  });

  it("rejects an unknown city unless Jev is sure it is Delhi", () => {
    expect(decidePick({ ...pick, city: null }, { ...good, inDelhi: 0.4 })).toEqual({
      approve: false,
      reason: "city-unknown",
    });
    expect(decidePick({ ...pick, city: null }, { ...good, inDelhi: 0.85 }).approve).toBe(true);
  });

  it("rejects a place the video text never names", () => {
    expect(decidePick(pick, { ...good, grounded: 0.3 })).toEqual({
      approve: false,
      reason: "not-grounded",
    });
  });

  it("rejects a dish name the LLM mistook for a place", () => {
    expect(decidePick({ ...pick, place_name: "Kale ke Chole Kulche" }, { ...good, isVenue: 0.2 })).toEqual({
      approve: false,
      reason: "not-a-venue",
    });
  });

  it("rejects a place the video does not recommend", () => {
    expect(decidePick(pick, { ...good, recommends: 0.2 })).toEqual({
      approve: false,
      reason: "not-recommended",
    });
  });

  it("rejects a low-confidence LLM extraction", () => {
    expect(decidePick({ ...pick, confidence: 0.3 }, good)).toEqual({
      approve: false,
      reason: "low-confidence",
    });
  });
});
