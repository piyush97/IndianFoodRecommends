import { expect, test } from "@playwright/test";

test.describe("near me", () => {
  test.use({ geolocation: { latitude: 28.68, longitude: 77.21 }, permissions: ["geolocation"] });

  test("sorts by distance only after the visitor asks", async ({ page }) => {
    await page.goto("/delhi/chole-bhature");
    await expect(page.getByText("Nearest first")).toHaveCount(0);
    await page.getByRole("button", { name: "Sort by distance from me" }).click();
    await expect(
      page.getByText("Nearest first. Your location stays on this device."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Chache Di Hatti", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sort by most picked" }).click();
  });
});

test("explains when location is blocked", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.goto("/delhi/chole-bhature");
  await page.getByRole("button", { name: "Sort by distance from me" }).click();
  await expect(page.getByText("Location is off, showing most picked first.")).toBeVisible();
  await context.close();
});
