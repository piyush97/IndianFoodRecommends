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
const good: PickCheck = {
  grounded: 0.9,
  dishGrounded: 0.9,
  isVenue: 0.9,
  recommends: 0.85,
  city: "delhi",
  cityConfidence: 0.9,
};

describe("decidePick", () => {
  it("approves a grounded, positive Delhi pick", () => {
    expect(decidePick(pick, good)).toEqual({ approve: true, city: "delhi" });
  });

  it("approves picks in every registered city", () => {
    expect(decidePick({ ...pick, city: "Bombay" }, good)).toEqual({
      approve: true,
      city: "mumbai",
    });
    expect(decidePick({ ...pick, city: "Kolkata" }, good)).toEqual({
      approve: true,
      city: "kolkata",
    });
  });

  it("rejects a city we do not cover", () => {
    expect(decidePick({ ...pick, city: "Pune" }, good)).toEqual({
      approve: false,
      reason: "not-supported-city",
    });
  });

  it("accepts New Delhi and NCR spellings", () => {
    expect(decidePick({ ...pick, city: "New Delhi" }, good).approve).toBe(true);
    expect(decidePick({ ...pick, city: "Gurgaon" }, good).approve).toBe(true);
  });

  it("uses Jev's city only when the LLM gave none and Jev is sure", () => {
    expect(decidePick({ ...pick, city: null }, { ...good, cityConfidence: 0.4 })).toEqual({
      approve: false,
      reason: "city-unknown",
    });
    expect(
      decidePick({ ...pick, city: null }, { ...good, city: "other", cityConfidence: 0.95 }),
    ).toEqual({
      approve: false,
      reason: "city-unknown",
    });
    expect(
      decidePick({ ...pick, city: null }, { ...good, city: "mumbai", cityConfidence: 0.85 }),
    ).toEqual({
      approve: true,
      city: "mumbai",
    });
  });

  it("rejects a place the video text never names", () => {
    expect(decidePick(pick, { ...good, grounded: 0.3 })).toEqual({
      approve: false,
      reason: "not-grounded",
    });
  });

  it("rejects a dish name the LLM mistook for a place", () => {
    expect(
      decidePick({ ...pick, place_name: "Kale ke Chole Kulche" }, { ...good, isVenue: 0.2 }),
    ).toEqual({
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

  describe("community suggestions (visitor-supplied text)", () => {
    const submitted = { ...pick, submitted: true } as ExtractedPick & { submitted: true };

    it("does not trust the visitor's city: Jev must agree with it", () => {
      expect(
        decidePick(
          { ...submitted, city: "Delhi" },
          { ...good, city: "mumbai", cityConfidence: 0.95 },
        ),
      ).toEqual({
        approve: false,
        reason: "city-mismatch",
      });
      expect(decidePick({ ...submitted, city: "Delhi" }, { ...good, cityConfidence: 0.5 })).toEqual(
        {
          approve: false,
          reason: "city-mismatch",
        },
      );
      expect(decidePick({ ...submitted, city: "Delhi" }, good)).toEqual({
        approve: true,
        city: "delhi",
      });
    });

    it("requires the video to mention the submitted dish", () => {
      expect(decidePick(submitted, { ...good, dishGrounded: 0.2 })).toEqual({
        approve: false,
        reason: "dish-not-grounded",
      });
    });
  });
});
