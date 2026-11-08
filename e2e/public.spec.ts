import { expect, test } from "@playwright/test";

test("search → ranked places → place → watch the moment", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search dish, place or creator" }).fill("chole bature");
  await page.getByRole("button", { name: "Search" }).click();

  // Search lists the dish's places directly, ranked by creator count.
  await expect(page.getByRole("heading", { level: 2, name: "Chole Bhature" })).toBeVisible();
  await expect(page.getByText("Picked by 1 creator")).toBeVisible();

  await page.getByRole("link", { name: "Chache Di Hatti", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chache Di Hatti");
  await expect(page.locator("iframe")).toHaveCount(0);

  await page.getByRole("button", { name: "Play E2E Creator's video at 4:12" }).click();
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?start=252/,
  );
});

test("no horizontal overflow at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of [
    "/",
    "/delhi/chole-bhature",
    "/delhi/place/chache-di-hatti",
    "/search?q=chole",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(360);
  }
});

test("unknown pages answer 404 before rendering, real pages 200", async ({ page }) => {
  for (const path of ["/pune", "/delhi/pizza", "/delhi/place/nope", "/creator/nobody"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  }
  for (const path of ["/delhi", "/delhi/chole-bhature", "/delhi/place/chache-di-hatti"])
    expect((await page.goto(path))?.status(), path).toBe(200);
});
