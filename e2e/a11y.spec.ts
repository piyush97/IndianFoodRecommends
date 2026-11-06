import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/",
  "/delhi",
  "/delhi/chole-bhature",
  "/delhi/place/chache-di-hatti",
  "/creator/e2e-creator",
  "/search?q=chole",
  "/search?q=zzzz",
  "/about",
  "/submit",
];

for (const path of PAGES) {
  test(`no serious axe violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(serious).toEqual([]);
  });
}

test("focus moves into the video after pressing play", async ({ page }) => {
  await page.goto("/delhi/place/chache-di-hatti");
  await page.getByRole("button", { name: "Play E2E Creator's video at 4:12" }).click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("IFRAME");
});

test("headings never skip a level", async ({ page }) => {
  for (const path of ["/delhi/chole-bhature", "/creator/e2e-creator", "/"]) {
    await page.goto(path);
    const levels = await page
      .locator("h1, h2, h3, h4")
      .evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1], `${path}: ${levels.join(",")}`).toBeLessThanOrEqual(1);
    }
  }
});
