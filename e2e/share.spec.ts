import { expect, test } from "@playwright/test";

test.beforeEach(({ context }) => context.grantPermissions(["clipboard-read", "clipboard-write"]));

for (const [path, name] of [
  ["/delhi/place/chache-di-hatti", "Chache Di Hatti"],
  ["/delhi/chole-bhature", "Chole Bhature in Delhi"],
] as const) {
  test(`share copies the canonical link on ${path}`, async ({ page }) => {
    // Desktop Chromium has no share sheet in some builds; force the copy path so the test is stable.
    await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
    await page.goto(path);
    await page.getByRole("button", { name: new RegExp(`^Share ${name}`) }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(copied).pathname).toBe(path);
  });
}
