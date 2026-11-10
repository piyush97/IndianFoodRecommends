import { describe, expect, it } from "vitest";
import type { PickCard } from "./public/queries";
import { listShareText, parseListParam } from "./list-params";

function card(citySlug: string, creators: string[]): PickCard {
  return {
    citySlug,
    placeSlug: `${citySlug}-${creators.join("")}`,
    placeName: "P",
    creators: creators.map((slug) => ({ slug, name: slug })),
  } as PickCard;
}

describe("parseListParam", () => {
  it("parses and sanitises", () => expect(parseListParam("b,a,,A,../x,b")).toEqual(["b", "a"]));
  it("caps at 30", () =>
    expect(parseListParam(Array.from({ length: 500 }, (_, i) => `p${i}`).join(","))).toHaveLength(
      30,
    ));
  it("takes the first value of an array", () =>
    expect(parseListParam(["a,b", "c"])).toEqual(["a", "b"]));
  it("handles missing and empty input", () => {
    expect(parseListParam(undefined)).toEqual([]);
    expect(parseListParam("")).toEqual([]);
    expect(parseListParam([])).toEqual([]);
  });
  it("drops unicode, over-long and whitespace slugs", () => {
    expect(parseListParam(`ok,é,${"a".repeat(81)}, x ,%2e%2e,a/b`)).toEqual(["ok"]);
  });
  it("does not let invalid entries use up the cap", () => {
    const junk = Array.from({ length: 100 }, () => "../x");
    expect(parseListParam([...junk, "good"].join(","))).toEqual(["good"]);
  });
});

describe("listShareText", () => {
  it("share text, one city", () =>
    expect(listShareText([card("delhi", ["x"]), card("delhi", ["x", "y"])])).toBe(
      "2 places to eat in Delhi, picked by 2 food vloggers",
    ));
  it("share text, many cities", () =>
    expect(listShareText([card("delhi", ["x"]), card("mumbai", ["x"])])).toBe(
      "2 places to eat across 2 cities, picked by 1 food vlogger",
    ));
  it("uses the singular for one place", () =>
    expect(listShareText([card("delhi", ["x"])])).toBe(
      "1 place to eat in Delhi, picked by 1 food vlogger",
    ));
});
