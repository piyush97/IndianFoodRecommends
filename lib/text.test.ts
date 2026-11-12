import { describe, expect, it } from "vitest";
import { canonicalDishName, normalizeName, placeKey, slugify, trigramSimilarity } from "./text";

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

  it("keeps Arabic, Greek and Cyrillic letters", () => {
    expect(normalizeName("کریم")).toBe("کریم");
    expect(normalizeName("Καφές")).toBe("καφες");
    expect(normalizeName("Москва")).toBe("москва");
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

describe("placeKey", () => {
  it("drops shop-type words, brackets and apostrophes", () => {
    expect(placeKey("Hotel Shadab")).toBe("shadab");
    expect(placeKey("Rameshwaram Café")).toBe("rameshwaram");
    expect(placeKey("Dilruba Restaurant (Cabin)")).toBe("dilruba");
    expect(placeKey("Karim's")).toBe("karims");
  });

  it("keeps food words that tell shops apart", () => {
    expect(placeKey("Arsalan Biryani")).toBe("arsalan biryani");
    expect(placeKey("Kake Di Hatti")).toBe("kake di hatti");
  });

  it("drops a trailing locality, written with or without spaces", () => {
    expect(placeKey("MTR Lalbagh (Mavalli Tiffin Rooms)", "Doddamavalli, Lal Bagh")).toBe("mtr");
    expect(placeKey("Karim's Madhyamgram", "Madhyamgram")).toBe("karims");
  });

  it("is empty when only shop-type words are left", () => {
    expect(placeKey("Restaurant")).toBe("");
    expect(placeKey("Madhyamgram", "Madhyamgram")).toBe("madhyamgram");
  });
});

describe("trigramSimilarity", () => {
  it("matches pg_trgm similarity()", () => {
    expect(trigramSimilarity("word", "word")).toBe(1);
    expect(trigramSimilarity("word", "two words")).toBeCloseTo(4 / 11);
    expect(trigramSimilarity("", "")).toBe(0);
  });
});
