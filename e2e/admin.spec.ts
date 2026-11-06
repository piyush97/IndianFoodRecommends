import { expect, test } from "@playwright/test";

// The layout's auth redirect does not stop the page from rendering in parallel,
// so the page itself must refuse anonymous visitors.
test("anonymous visitors get no admin content", async ({ request }) => {
  const variants: Record<string, string>[] = [{}, { RSC: "1" }];
  for (const headers of variants) {
    const res = await request.get("/admin/review", { headers, maxRedirects: 0 });
    const body = await res.text();
    expect(body).not.toContain("Review queue");
    expect(body).not.toContain("Add a pick by hand");
    expect(body).not.toContain("Queue clear");
  }
});
