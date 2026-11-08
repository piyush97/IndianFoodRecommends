import { describe, expect, it } from "vitest";
import { canonicalDishName, normalizeName, slugify } from "./text";

describe("slugify", () => {
  it("lowercases words and joins them with hyphens", () => {
    expect(slugify("Chache Di Hatti")).toBe("chache-di-hatti");
  });

  it("drops punctuation and collapses whitespace and repeated hyphens", () => {
    expect(slugify("  Sita Ram's  Diwan-Chand!! ")).toBe("sita-rams-diwan-chand");
  });

  it("falls back to item when no ascii letters survive", () => {
    expect(slugify("चाचे")).toBe("item");
  });
});

describe("normalizeName", () => {
  it("strips latin diacritics and folds spacing and hyphens", () => {
    expect(normalizeName("Chāche  Dī-Hatti")).toBe("chache di hatti");
  });

  it("keeps Devanagari characters and only folds whitespace", () => {
    expect(normalizeName("चाचे दी हट्टी")).toBe("चाचे दी हट्टी");
  });
});

describe("canonicalDishName", () => {
  it("drops serving qualifiers", () => {
    expect(canonicalDishName("Desi Ghee Chole Bhature")).toBe("Chole Bhature");
    expect(canonicalDishName("  Famous   Butter Chicken ")).toBe("Butter Chicken");
  });

  it("keeps names that would shrink to one word", () => {
    expect(canonicalDishName("Ghee Roast")).toBe("Ghee Roast");
    expect(canonicalDishName("Special Thali")).toBe("Special Thali");
  });

  it("leaves other dishes alone", () => {
    expect(canonicalDishName("Rabdi Gulab Jamun")).toBe("Rabdi Gulab Jamun");
  });
});
