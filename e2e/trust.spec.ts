import { expect, test } from "@playwright/test";

const CLOSED = "/delhi/place/closed-chaat-corner";

test("a closed place is off the city page but keeps its own page, marked noindex", async ({
  page,
}) => {
  await page.goto("/delhi");
  await expect(page.getByRole("link", { name: "Chache Di Hatti", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Closed Chaat Corner" })).toHaveCount(0);

  expect((await page.goto(CLOSED))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Closed Chaat Corner");
  await expect(page.getByText(/Closed \(confirmed Sep[a-z]* 2026\)/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});

test("a place three visitors reported shows the checking note", async ({ page }) => {
  await page.goto("/delhi/place/flagged-sweet-shop");
  await expect(page.getByText("Visitors reported this closed. We are checking.")).toBeVisible();
  await page.goto("/delhi");
  await expect(page.getByText("Visitors reported this closed. We are checking.")).toBeVisible();
});

test("a shared list still shows a closed place, labelled", async ({ page }) => {
  await page.goto("/list?p=closed-chaat-corner");
  await expect(page.getByRole("link", { name: "Closed Chaat Corner", exact: true })).toBeVisible();
  await expect(page.getByText(/Closed \(confirmed/)).toBeVisible();
});
