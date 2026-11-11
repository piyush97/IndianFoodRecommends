import { describe, expect, it } from "vitest";
import { normalizeName } from "./text";
import { SYNONYM_GROUPS, expandQuery } from "./synonyms";

describe("expandQuery", () => {
  it("expands a spelling", () =>
    expect(expandQuery("Golgappe")).toEqual(
      expect.arrayContaining(["golgappe", "pani puri", "puchka"]),
    ));
  it("expands Devanagari with trailing space", () =>
    expect(expandQuery("पानी पूरी ")).toContain("pani puri"));
  it("expands a Devanagari query to the Latin names", () =>
    expect(expandQuery("गोलगप्पे")).toEqual(expect.arrayContaining(["gol gappe", "puchka"])));
  it("keeps the raw query first", () => {
    const terms = expandQuery("chicken biryani");
    expect(terms[0]).toBe("chicken biryani");
    expect(terms).toContain("biriyani");
  });
  it("does not merge chicken and mutton biryani", () => {
    expect(expandQuery("chicken biryani")).not.toContain("mutton biryani");
  });
  it("whole words only", () => expect(expandQuery("momoland")).toEqual(["momoland"]));
  it("returns just the query when nothing matches", () =>
    expect(expandQuery("Tiramisu ")).toEqual(["tiramisu"]));
  it("returns nothing for a blank query", () => {
    expect(expandQuery("")).toEqual([]);
    expect(expandQuery("   ")).toEqual([]);
  });
  it("has no duplicate terms and caps at 12", () => {
    for (const g of SYNONYM_GROUPS) {
      const terms = expandQuery(g[0]!);
      expect(new Set(terms).size).toBe(terms.length);
      expect(terms.length).toBeLessThanOrEqual(12);
    }
    expect(expandQuery("pani puri").length).toBeLessThanOrEqual(12);
  });
  it("caps an oversized expansion at 12", () => {
    const q = "pani puri biryani momos nihari";
    const terms = expandQuery(q);
    expect(terms[0]).toBe(q);
    expect(terms).toHaveLength(12);
  });
});

describe("SYNONYM_GROUPS", () => {
  it("every group term is normalized", () => {
    for (const g of SYNONYM_GROUPS) for (const t of g) expect(normalizeName(t)).toBe(t);
  });
  it("no term in two groups", () => {
    const all = SYNONYM_GROUPS.flat();
    expect(new Set(all).size).toBe(all.length);
  });
  it("groups have at least two terms", () => {
    for (const g of SYNONYM_GROUPS) expect(g.length).toBeGreaterThanOrEqual(2);
  });
});
