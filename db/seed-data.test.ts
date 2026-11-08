import { describe, expect, it } from "vitest";
import { cities, creators, dishes } from "./seed-data";
import { CITIES } from "../lib/cities";

const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

describe("seed data", () => {
  it("seeds creators with unique YouTube channel ids and unique slugs", () => {
    expect(creators.length).toBeGreaterThanOrEqual(33);
    expect(new Set(creators.map((c) => c.slug)).size).toBe(creators.length);
    const ids = creators.map((c) => c.ytChannelId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^UC[0-9A-Za-z_-]{22}$/);
  });

  it("seeds the Ayush Sapra channel", () => {
    const ayush = creators.find((c) => c.slug === "ayush-sapra");
    expect(ayush?.ytChannelId).toBe("UC2UWtuZR3kH-5C26HVMMB6A");
  });

  it("seeds at least 30 dishes", () => {
    expect(dishes.length).toBeGreaterThanOrEqual(30);
  });

  it("uses unique kebab-case slugs", () => {
    const slugs = dishes.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toBe(slugOf(slug));
  });

  it("has unique dish names", () => {
    const names = dishes.map((d) => d.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  // The matcher (S1-4) resolves vlogger wording against names and aliases, so an
  // alias that is also another dish's name would make matching ambiguous.
  it("keeps aliases unambiguous", () => {
    const taken = new Set<string>();
    for (const d of dishes) {
      taken.add(d.slug);
      taken.add(d.name.toLowerCase());
    }
    const seenAliases = new Set<string>();
    for (const d of dishes) {
      for (const alias of d.aliases ?? []) {
        const key = alias.toLowerCase();
        expect(taken.has(key), `alias "${alias}" collides with a dish`).toBe(false);
        expect(seenAliases.has(key), `alias "${alias}" used twice`).toBe(false);
        seenAliases.add(key);
      }
    }
  });

  it("has a Delhi city with a stable slug", () => {
    expect(cities.map((c) => c.slug)).toContain("delhi");
  });

  it("seeds every registry city", () => {
    expect(cities.map((c) => c.slug)).toEqual(CITIES.map((c) => c.slug));
  });
});
