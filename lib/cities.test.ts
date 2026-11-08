import { describe, expect, it } from "vitest";
import { CITIES, cityFromName } from "./cities";

describe("cityFromName", () => {
  it.each([
    ["Delhi", "delhi"],
    ["New Delhi", "delhi"],
    ["Gurugram", "delhi"],
    ["noida", "delhi"],
    ["Mumbai", "mumbai"],
    ["Bombay", "mumbai"],
    ["Navi Mumbai", "mumbai"],
    ["Kolkata", "kolkata"],
    ["Calcutta", "kolkata"],
    ["Secunderabad", "hyderabad"],
    ["Bangalore", "bengaluru"],
    ["Madras", "chennai"],
    ["Lucknow", "lucknow"],
    ["Jaipur", "jaipur"],
  ])("maps %s to %s", (name, slug) => {
    expect(cityFromName(name)?.slug).toBe(slug);
  });

  it.each(["Pune", "", null, undefined, "Delhi Darbar"])("does not guess for %s", (name) => {
    expect(cityFromName(name)).toBeNull();
  });

  it("lists Delhi first and has unique slugs", () => {
    expect(CITIES[0].slug).toBe("delhi");
    expect(new Set(CITIES.map((c) => c.slug)).size).toBe(CITIES.length);
  });
});
