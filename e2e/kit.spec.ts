import { expect, test } from "@playwright/test";

test("creator kit shows a working badge and snippet", async ({ page, request }) => {
  const badge = await request.get("/creator/e2e-creator/badge");
  expect(badge.status()).toBe(200);
  expect(badge.headers()["content-type"]).toContain("image/svg+xml");
  expect(badge.headers()["cache-control"]).toContain("stale-while-revalidate");
  expect(await badge.text()).toContain("E2E Creator: 1 pick on Indian Food Recommends");
  const light = await request.get("/creator/e2e-creator/badge?theme=light");
  expect(await light.text()).toContain('fill="#fdfbf7" stroke');
  expect((await request.get("/creator/nobody/badge")).status()).toBe(404);

  await page.goto("/creator/e2e-creator");
  await page.getByRole("link", { name: "Creator share kit" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Share kit for E2E Creator");
  await expect(
    page.getByRole("img", { name: "E2E Creator: 1 pick on Indian Food Recommends" }),
  ).toBeVisible();
  await expect(page.getByLabel("HTML to paste")).toHaveValue(
    /href="[^"]*\/creator\/e2e-creator\?utm_source=creator&utm_medium=badge&utm_campaign=e2e-creator"><img src="[^"]*\/creator\/e2e-creator\/badge"/,
  );
  await expect(page.getByLabel("Markdown to paste")).toHaveValue(/^\[!\[E2E Creator: 1 pick/);
  await expect(page.getByLabel("Share text")).toHaveValue(/1 pick from my videos/);
  await page.getByRole("link", { name: "Light badge" }).click();
  await expect(page.getByLabel("HTML to paste")).toHaveValue(/\/badge\?theme=light/);
  await expect(page.getByRole("link", { name: "Light badge" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  const story = page.getByRole("link", { name: "Download story" });
  await expect(story).toHaveAttribute("href", "/creator/e2e-creator/story");
  await expect(story).toHaveAttribute("download", "e2e-creator-story.png");
  const png = await request.get("/creator/e2e-creator/story");
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
  expect((await request.get("/creator/nobody/story")).status()).toBe(404);

  await expect(page.getByLabel("Tracked link")).toHaveValue(
    /\/creator\/e2e-creator\?utm_source=creator&utm_campaign=e2e-creator$/,
  );
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("status").first()).toHaveText(/Copied|Could not copy/);
});
