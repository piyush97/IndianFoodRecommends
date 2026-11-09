import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITIES } from "../cities";
import { OG_COLORS, OG_ROUTE } from "./og";

const css = readFileSync("app/globals.css", "utf8");
const token = (name: string) =>
  css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];

describe("share card colours", () => {
  it("match the site tokens", () => {
    for (const name of ["ink", "muted", "paper", "line", "accent"] as const) {
      expect(OG_COLORS[name], name).toBe(token(name));
    }
  });

  it("paint every city in its route colour", () => {
    for (const city of CITIES) {
      expect(OG_ROUTE[city.slug]?.bg, city.slug).toBe(token(`route-${city.slug}`));
    }
  });
});
