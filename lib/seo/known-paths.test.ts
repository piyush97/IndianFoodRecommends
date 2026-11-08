import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isKnownPath, STATIC_ROUTES, type PathIndex } from "./known-paths";

const index: PathIndex = {
  places: new Set(["delhi/chache-di-hatti"]),
  dishes: new Set(["delhi/chole-bhature"]),
  creators: new Set(["sadi-gaddi"]),
};
const known = (path: string) => isKnownPath(path.split("/").filter(Boolean), index);

describe("isKnownPath", () => {
  it("accepts real pages", () => {
    for (const path of [
      "/",
      "/delhi",
      "/delhi/chole-bhature",
      "/delhi/place/chache-di-hatti",
      "/delhi/place/chache-di-hatti/opengraph-image-1a2b3c",
      "/creator/sadi-gaddi",
      "/creator/sadi-gaddi/kit",
      "/creator/sadi-gaddi/badge",
      "/about",
      "/search",
      "/submit",
      "/opengraph-image-9z",
    ])
      expect(known(path), path).toBe(true);
  });

  it("rejects unknown slugs and stray depth", () => {
    for (const path of [
      "/pune",
      "/delhi/pizza",
      "/mumbai/chole-bhature",
      "/delhi/place/nope",
      "/delhi/place/chache-di-hatti/extra",
      "/creator/nobody",
      "/creator/sadi-gaddi/a/b",
      "/about/team",
      "/delhi/chole-bhature/more/deep",
    ])
      expect(known(path), path).toBe(false);
  });

  it("knows every top-level route directory", () => {
    const dirs = [...readdirSync("app/(public)"), ...readdirSync("app")]
      .filter((name) => !/[.[(_]/.test(name))
      .filter((name) => !["favicon"].includes(name));
    for (const dir of new Set(dirs))
      expect(STATIC_ROUTES, `add "${dir}" to STATIC_ROUTES`).toContain(dir);
  });
});
