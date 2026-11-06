import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

function directives(csp: string): Record<string, string> {
  return Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...rest] = d.split(/\s+/);
        return [name, rest.join(" ")];
      }),
  );
}

describe("buildCsp", () => {
  it("allows only the embeds and map host without analytics", () => {
    const d = directives(buildCsp({ analytics: false }));
    expect(d["frame-src"]).toBe("https://www.youtube-nocookie.com https://www.instagram.com");
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["object-src"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
    expect(d["form-action"]).toBe("'self' https://github.com");
    expect(d["connect-src"]).toContain("https://tiles.openfreemap.org");
    expect(d["worker-src"]).toBe("'self' blob:");
    expect(buildCsp({ analytics: false })).not.toContain("umami");
  });

  it("adds Umami hosts when analytics is on", () => {
    const d = directives(buildCsp({ analytics: true }));
    expect(d["script-src"]).toContain("https://cloud.umami.is");
    expect(d["connect-src"]).toContain("https://api-gateway.umami.dev");
  });
});
