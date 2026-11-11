import { expect, test } from "@playwright/test";

// Chandni Chowk: the seeded "Chandni Chowk Chaat" is about 25 m away, the older picks 2.9 km.
const CHANDNI_CHOWK = { latitude: 28.656, longitude: 77.23 };

test.describe("granted", () => {
  test.use({ geolocation: CHANDNI_CHOWK, permissions: ["geolocation"] });

  test("lists the nearest pick first and never sends the position", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto("/");
    await page.getByRole("button", { name: "Picks near me" }).click();

    const section = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Picks near you" }),
    });
    await expect(section).toBeVisible({ timeout: 5_000 });
    await expect(section.getByRole("listitem").first()).toContainText("Chandni Chowk Chaat");
    await expect(page.getByRole("status")).toContainText("Your location stays on this device");
    expect(urls.filter((u) => /[?&](lat|lng)=/.test(u))).toEqual([]);
  });
});

test("says so, in the status region, when location is blocked", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.goto("/");
  // Under a loaded parallel run the first click can land before hydration attaches the handler.
  await expect(async () => {
    await page.getByRole("button", { name: "Picks near me" }).click();
    await expect(page.getByRole("status")).toHaveText("Location is off. Type an area instead.", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 10_000 });
  await expect(page.getByLabel("Area or landmark")).toBeFocused();
  await context.close();
});
