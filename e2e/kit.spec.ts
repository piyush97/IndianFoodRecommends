import { expect, test } from "@playwright/test";

test("creator kit shows a working badge and snippet", async ({ page, request }) => {
  const badge = await request.get("/creator/e2e-creator/badge");
  expect(badge.status()).toBe(200);
  expect(badge.headers()["content-type"]).toContain("image/svg+xml");
  expect(await badge.text()).toContain("E2E Creator: 1 pick on Indian Food Recommends");
  expect((await request.get("/creator/nobody/badge")).status()).toBe(404);

  await page.goto("/creator/e2e-creator");
  await page.getByRole("link", { name: "Creator share kit" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Share kit for E2E Creator");
  await expect(
    page.getByRole("img", { name: "E2E Creator on Indian Food Recommends" }),
  ).toBeVisible();
  await expect(page.getByLabel("HTML to paste")).toHaveValue(/\/creator\/e2e-creator\/badge/);
});
