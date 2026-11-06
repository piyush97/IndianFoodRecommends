import { expect, test } from "@playwright/test";

test("a visitor can suggest a pick without CSP violations", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
  await page.goto("/submit");
  await page.getByLabel("YouTube video link").fill("https://youtu.be/abcdefghijk");
  await page.getByRole("combobox", { name: "Creator" }).selectOption({ label: "E2E Creator" });
  await page.getByRole("combobox", { name: "City" }).selectOption({ label: "Delhi" });
  await page.getByLabel("Place name").fill("Sita Ram Diwan Chand");
  await page.getByLabel("Dish").fill("Chole Bhature");
  await page.getByLabel("Timestamp (optional)").fill("2:30");
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Thanks. We check every suggestion against the video before it shows.",
  );
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});
