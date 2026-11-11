import { expect, test } from "@playwright/test";

test("search → ranked places → place → watch the moment", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search dish, place or creator" }).fill("chole bature");
  await page.getByRole("button", { name: "Search", exact: true }).click();

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

test.describe("diet filter", () => {
  test("keeps veg places and empties the list for non-veg", async ({ page }) => {
    await page.goto("/delhi?diet=veg");
    await expect(page.getByRole("link", { name: "Veg", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("link", { name: "Chache Di Hatti", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Non-veg", exact: true }).click();
    await expect(page).toHaveURL(/\/delhi\?diet=non-veg$/);
    await expect(page.getByText("No non-veg picks yet for Delhi.")).toBeVisible();
    await page.getByRole("link", { name: "All", exact: true }).click();
    await expect(page.getByRole("link", { name: "Chache Di Hatti", exact: true })).toBeVisible();
  });

  test("filters search results and offers a way back", async ({ page }) => {
    await page.goto("/search?q=chole&diet=non-veg");
    await expect(page.getByText("No non-veg picks for “chole”.")).toBeVisible();
    await page.getByRole("link", { name: "Show all" }).click();
    await expect(
      page.getByRole("link", { name: "Chache Di Hatti", exact: true }).first(),
    ).toBeVisible();
  });
});

test("city page shows every place as a pin on a map", async ({ page }) => {
  await page.goto("/delhi");
  await page.getByRole("button", { name: "Map" }).click();
  await expect(page.getByRole("button", { name: /Chache Di Hatti/ })).toBeVisible();
});

test("place page links to Google Maps, Zomato and Swiggy", async ({ page }) => {
  await page.goto("/delhi/place/chache-di-hatti");
  const find = page.getByRole("navigation", { name: "Find Chache Di Hatti on other apps" });
  await expect(find.getByRole("link", { name: /^Google Maps/ })).toHaveAttribute(
    "href",
    /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Chache%20Di%20Hatti/,
  );
  await expect(find.getByRole("link", { name: /^Zomato/ })).toHaveAttribute(
    "href",
    /site%3Azomato\.com$/,
  );
  await expect(find.getByRole("link", { name: /^Swiggy/ })).toHaveAttribute(
    "href",
    "https://www.swiggy.com/search?query=Chache%20Di%20Hatti",
  );
});

test("the current city's tab is marked and the site ships its own icons and manifest", async ({
  page,
  request,
}) => {
  await page.goto("/delhi");
  const tabs = page.getByRole("navigation", { name: "Cities" });
  await expect(tabs.getByRole("link", { name: /^Delhi/ })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f2eee5");

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).name).toBe("Indian Food Recommends");
  for (const icon of ["/icon.png", "/apple-icon.png", "/favicon.ico"]) {
    expect((await request.get(icon)).ok(), icon).toBe(true);
  }
});

test("a place page lists nearby picks with distance", async ({ page }) => {
  await page.goto("/delhi/place/chache-di-hatti");
  const nearby = page.getByRole("heading", { name: "Nearby picks" }).locator("xpath=..");
  const link = nearby.getByRole("link", { name: /Kamla Nagar Dhaba/ });
  await expect(link).toContainText("220 m");
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: "Kamla Nagar Dhaba" })).toBeVisible();
});
