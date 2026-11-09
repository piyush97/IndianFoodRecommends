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

test.describe("custom location", () => {
  test("sorts from a typed area and says where the text went", async ({ page }) => {
    await page.route("**/api/geocode?*", (route) =>
      route.fulfill({
        json: { lat: 28.61, lng: 77.2, label: "Connaught Place", via: "openstreetmap" },
      }),
    );
    await page.goto("/delhi/chole-bhature");
    await page.getByLabel("Or sort from an area or landmark").fill("Connaught Place");
    await page.getByRole("button", { name: "Sort from here" }).click();
    await expect(
      page.getByText(
        "Nearest first to “Connaught Place”. The text you typed was sent to OpenStreetMap",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Chache Di Hatti", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sort by most picked" }).click();
    await expect(page.getByText("Nearest first to")).toHaveCount(0);
  });

  test("finds a misspelt area in our own list without leaving the site", async ({ page }) => {
    // Not mocked: this goes through /api/geocode and the areas table the e2e seed builds.
    await page.goto("/delhi/chole-bhature");
    await page.getByLabel("Or sort from an area or landmark").fill("kamala nagr");
    await page.getByRole("button", { name: "Sort from here" }).click();
    await expect(
      page.getByText(
        "Nearest first to “Kamla Nagar”. Matched against our own list of areas, nothing you typed left this site.",
      ),
    ).toBeVisible();
  });

  test("offers close names when the area is not found", async ({ page }) => {
    await page.route("**/api/geocode?*", (route) =>
      route.fulfill({
        status: 404,
        json: {
          error: "Could not find that place in Delhi.",
          suggestions: [{ name: "Chandni Chowk", lat: 28.656, lng: 77.23 }],
        },
      }),
    );
    await page.goto("/delhi/chole-bhature");
    await page.getByLabel("Or sort from an area or landmark").fill("chandni chok");
    await page.getByRole("button", { name: "Sort from here" }).click();
    await page.getByRole("button", { name: "Chandni Chowk" }).click();
    await expect(page.getByText("Nearest first to “Chandni Chowk”.")).toBeVisible();
  });

  test("shows the server message when the area is not found", async ({ page }) => {
    await page.route("**/api/geocode?*", (route) =>
      route.fulfill({ status: 404, json: { error: "Could not find that place in Delhi." } }),
    );
    await page.goto("/delhi/chole-bhature");
    await page.getByLabel("Or sort from an area or landmark").fill("Nowhere Nagar");
    await page.getByRole("button", { name: "Sort from here" }).click();
    await expect(
      page.getByText("Could not find that place in Delhi. Showing most picked first."),
    ).toBeVisible();
  });
});
