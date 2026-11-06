import { expect, test, type Page } from "@playwright/test";

async function collectViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  return () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
}

test("place page sends the CSP and plays the video without violations", async ({ page }) => {
  const violations = await collectViolations(page);
  const response = await page.goto("/delhi/place/chache-di-hatti");
  expect(response?.headers()["content-security-policy"]).toContain("frame-src");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  await page.getByRole("button", { name: "Play E2E Creator's video at 4:12" }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("button", { name: "Show map" }).click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
  expect(await violations()).toEqual([]);
});

test("dish page map loads under the CSP", async ({ page }) => {
  const violations = await collectViolations(page);
  await page.goto("/delhi/chole-bhature");
  await page.getByRole("button", { name: "Map" }).click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(await violations()).toEqual([]);
});
