import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminDir = __dirname;

// Pages exempt from the guard. Each entry needs a reason.
const ALLOWED = new Set([
  // Index only redirects to /admin/review; reads no data.
  "page.tsx",
]);

const pages = (readdirSync(adminDir, { recursive: true, encoding: "utf8" }) as string[])
  .filter((f) => f === "page.tsx" || f.endsWith("/page.tsx"))
  .filter((f) => !ALLOWED.has(f));

describe("admin pages", () => {
  it("finds admin pages to check", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)("%s calls requireAdminPage()", (file) => {
    const src = readFileSync(join(adminDir, file), "utf8");
    expect(src).toContain("requireAdminPage(");
  });
});
