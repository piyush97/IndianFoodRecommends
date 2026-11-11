import { expect, test } from "@playwright/test";

test("search links to each city's dish page", async ({ page }) => {
  await page.goto("/search?q=chole");
  await page.getByRole("link", { name: "Chole Bhature in Delhi" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chole Bhature in Delhi");
});

test("dish near area searches spend the search rate limit", async ({ request }) => {
  // The limiter keys on x-forwarded-for: an address of its own cannot drain the bucket the other
  // tests share, and a new one per run starts with a full bucket (buckets outlive the seed).
  const octet = () => 1 + Math.floor(Math.random() * 254);
  const headers = { "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` };
  const limited = "Too many searches from this connection";
  const search = async () =>
    (await request.get("/search?city=delhi&q=chole+bhature+near+kamla+nagar", { headers })).text();

  const first = await search();
  expect(first).toContain("Within 2 km of");
  expect(first).not.toContain(limited);
  // 30 tokens, one back every 2 s: request 31 is refused, or a few later on a slow machine.
  let body = first;
  for (let n = 2; n <= 40 && !body.includes(limited); n++) body = await search();
  expect(body).toContain(limited);
  expect(body).not.toContain("Within 2 km of");
});
