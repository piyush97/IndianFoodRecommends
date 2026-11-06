import { describe, expect, it } from "vitest";
import { badgeSvg } from "./badge";

describe("badgeSvg", () => {
  it("escapes the creator name", () => {
    const svg = badgeSvg({ name: 'A<b>&"c', picks: 2 });
    expect(svg).toContain("A&lt;b&gt;&amp;&quot;c");
    expect(svg).not.toContain("<b>");
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("pluralises picks", () => {
    expect(badgeSvg({ name: "X", picks: 1 })).toContain("1 pick on Indian Food Recommends");
    expect(badgeSvg({ name: "X", picks: 7 })).toContain("7 picks on Indian Food Recommends");
  });

  it("grows with longer text", () => {
    const width = (s: string) => Number(/width="(\d+)"/.exec(s)![1]);
    expect(
      width(badgeSvg({ name: "A very long creator name indeed", picks: 120 })),
    ).toBeGreaterThan(width(badgeSvg({ name: "A", picks: 1 })));
  });

  it("has an accessible title", () => {
    expect(badgeSvg({ name: "Bhooka Saand", picks: 7 })).toContain(
      "<title>Bhooka Saand: 7 picks on Indian Food Recommends</title>",
    );
  });
});
