import { expect, test } from "@playwright/test";

test("search links to each city's dish page", async ({ page }) => {
  await page.goto("/search?q=chole");
  await page.getByRole("link", { name: "Chole Bhature in Delhi" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chole Bhature in Delhi");
});
