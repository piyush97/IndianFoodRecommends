import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Deterministic basemap: these tests verify our overlays and controls, not a third-party service.
test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/styles/liberty", (route) =>
    route.fulfill({
      json: {
        version: 8,
        glyphs: "http://localhost:3201/glyphs/{fontstack}/{range}.pbf",
        sources: {},
        layers: [{ id: "ground", type: "background", paint: { "background-color": "#e8e2d4" } }],
      },
    }),
  );
  await page.route("**/glyphs/**", (route) =>
    route.fulfill({ body: Buffer.alloc(0), contentType: "application/x-protobuf" }),
  );
});

test("dish near area returns only the matching dish within 2 km", async ({ page }) => {
  await page.goto("/search?city=delhi&q=chole+bhature+near+kamla+nagar");
  await expect(page.getByText(/Within 2 km of/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Chache Di Hatti", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kamla Nagar Dhaba", exact: true })).toHaveCount(0);
});

test("neighbourhood pages, sitemap, OG and real unknown-area 404", async ({ page, request }) => {
  expect((await page.goto("/delhi/area/kamla-nagar"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Food in Kamla Nagar" })).toBeVisible();
  await expect(page.getByText(/within 1 km of the area centre/)).toBeVisible();
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toBeTruthy();
  const og = await request.get(new URL(image!).pathname);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toMatch(/image/);
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/delhi/area/kamla-nagar");
  expect((await page.goto("/delhi/area/does-not-exist"))?.status()).toBe(404);
});

test("viewport endpoint filters coordinates and validates its input", async ({ request }) => {
  const res = await request.get("/api/places?city=delhi&bbox=77.209,28.679,77.211,28.681");
  expect(res.status()).toBe(200);
  expect((await res.json()).cards.map((c: { placeSlug: string }) => c.placeSlug)).toEqual([
    "chache-di-hatti",
  ]);
  for (const query of [
    "city=delhi&bbox=1,2,3",
    "city=unknown&bbox=1,2,3,4",
    "city=delhi&bbox=1,2,3,4&diet=invalid",
  ])
    expect((await request.get(`/api/places?${query}`)).status()).toBe(400);
});

test("map viewport search is keyboard reachable and keeps the list in sync", async ({ page }) => {
  await page.goto("/delhi");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const search = page.getByRole("button", { name: "Search this area", exact: true });
  await expect(search).toBeEnabled();
  await search.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: /picks in view/ })).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("link", { name: "Chache Di Hatti", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset map search" }).click();
  await expect(page.getByRole("button", { name: "Reset map search" })).toHaveCount(0);
});

test("city density toggles stored cells and large maps request vector tiles", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/jaipur");
  const tile = page.waitForResponse((r) => r.url().includes("/api/tiles/") && r.status() === 200);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  expect((await tile).headers()["content-type"]).toContain("application/vnd.mapbox-vector-tile");
  await page.getByRole("button", { name: "Show food density" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Darker cells|Food density is not available/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hide food density" }).click();
  await expect(page.getByRole("button", { name: "Show food density" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator(".maplibregl-map").screenshot({ path: "/tmp/ifr-sprint7-map.png" });
  expect(errors).toEqual([]);
});

test("walk pages use five exact stops and a mobile-compatible Google Maps link", async ({
  page,
}) => {
  await page.goto("/delhi/walks");
  await expect(page.getByRole("status")).toContainText("No food walks meet the four-stop rule");
  await page.goto("/jaipur/walks");
  await page.getByRole("link", { name: "Test fixtures food walk", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Test fixtures food walk");
  const link = page.getByRole("link", { name: /Open walking directions/ });
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.searchParams.get("travelmode")).toBe("walking");
  expect(url.searchParams.get("waypoints")?.split("|")).toHaveLength(3);
  await expect(page.locator("main ol > li")).toHaveCount(5);
  await page.screenshot({ path: "/tmp/ifr-sprint7-walk.png", fullPage: true });
});

test("neighbourhood page remains accessible at mobile size and 200 percent zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/delhi/area/kamla-nagar");
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
  ).toEqual([]);
  await page.screenshot({ path: "/tmp/ifr-sprint7-area-mobile.png", fullPage: true });
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  const size = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(size.width).toBeLessThanOrEqual(size.viewport);
});
