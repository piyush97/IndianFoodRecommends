import { expect, test } from "@playwright/test";

test("save two places, open My list, share it, and a friend saves it all", async ({
  browser,
  baseURL,
}) => {
  const owner = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await owner.newPage();
  // The desktop share sheet would swallow the click; this forces the copy-link path.
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await page.goto("/delhi");
  await page.getByRole("button", { name: "Save Chache Di Hatti to my list" }).click();
  await page.getByRole("button", { name: "Save Kamla Nagar Dhaba to my list" }).click();
  await expect(page.getByRole("link", { name: /^My list\s*2$/ })).toBeVisible();

  await page.getByRole("link", { name: /^My list/ }).click();
  await expect(page).toHaveURL(/\/list\?p=kamla-nagar-dhaba%2Cchache-di-hatti$/);
  await expect(page.getByRole("link", { name: "Chache Di Hatti", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kamla Nagar Dhaba", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("utm_source=share");
  await owner.close();

  // The shared link points at the production site URL; open the same path on the test server.
  const shared = new URL(copied);
  const friend = await browser.newContext();
  const friendPage = await friend.newPage();
  await friendPage.goto(`${baseURL}${shared.pathname}${shared.search}`);
  await expect(friendPage.getByRole("link", { name: /^My list$/ })).toBeVisible();
  await friendPage.getByRole("button", { name: "Save all to my list" }).click();
  await expect(friendPage.getByRole("link", { name: /^My list\s*2$/ })).toBeVisible();
  await friend.close();
});
