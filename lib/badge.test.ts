import { describe, expect, it } from "vitest";
import { badgeSvg, badgeTheme, kitShareText, topPlaces } from "./badge";

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

  it("grows with a longer count", () => {
    const width = (s: string) => Number(/width="(\d+)"/.exec(s)![1]);
    expect(width(badgeSvg({ name: "A", picks: 1200 }))).toBeGreaterThan(
      width(badgeSvg({ name: "A", picks: 1 })),
    );
  });

  it("says featured on and switches the left half by theme", () => {
    const dark = badgeSvg({ name: "X", picks: 3 });
    const light = badgeSvg({ name: "X", picks: 3, theme: "light" });
    expect(dark).toContain(">Featured on Indian Food Recommends</text>");
    expect(dark).toContain('fill="#1a1614" stroke');
    expect(light).toContain('fill="#fdfbf7" stroke');
    expect(light).not.toEqual(dark);
  });

  it("has an accessible title", () => {
    expect(badgeSvg({ name: "Bhooka Saand", picks: 7 })).toContain(
      "<title>Bhooka Saand: 7 picks on Indian Food Recommends</title>",
    );
  });
});

describe("badgeTheme", () => {
  it("defaults anything but light to dark", () => {
    expect(badgeTheme("light")).toBe("light");
    expect(badgeTheme("dark")).toBe("dark");
    expect(badgeTheme(null)).toBe("dark");
    expect(badgeTheme("<script>")).toBe("dark");
  });
});

describe("kitShareText", () => {
  const picks = [
    { placeName: "One", dishes: ["Dosa"] },
    { placeName: "Three", dishes: ["Dosa", "Vada", "Idli"] },
    { placeName: "Two", dishes: ["Chai", "Bun"] },
    { placeName: "Also one", dishes: ["Lassi"] },
  ];

  it("ranks places by dish count and keeps three", () => {
    expect(topPlaces(picks).map((p) => p.placeName)).toEqual(["Three", "Two", "One"]);
  });

  it("uses the real total, top places and the link", () => {
    const text = kitShareText({ total: 7, picks, url: "https://x.test/creator/a" });
    expect(text).toContain("7 picks from my videos");
    expect(text).toContain("- Three: Dosa, Vada, Idli");
    expect(text).not.toContain("Also one");
    expect(text.endsWith("Map and timestamps: https://x.test/creator/a")).toBe(true);
    expect(text).not.toContain("\u2014");
  });

  it("skips the places block when there are none", () => {
    expect(kitShareText({ total: 0, picks: [], url: "u" })).not.toContain("Top places");
  });
});
