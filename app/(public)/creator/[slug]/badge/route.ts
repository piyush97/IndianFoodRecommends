import { connection } from "next/server";
import { badgeSvg, badgeTheme } from "../../../../../lib/badge";
import { cachedCreator } from "../../../data";

/** Embeddable SVG badge: `<img src="/creator/{slug}/badge">`, `?theme=light` for light pages. */
export async function GET(request: Request, ctx: RouteContext<"/creator/[slug]/badge">) {
  await connection();
  const { slug } = await ctx.params;
  const data = await cachedCreator(slug).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  const theme = badgeTheme(new URL(request.url).searchParams.get("theme"));
  return new Response(badgeSvg({ name: data.creator.name, picks: data.total, theme }), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Matches cachedCreator's "hours" life: fresh for an hour, stale copy served while it refreshes.
      "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      // Shown on other sites: block scripts inside the SVG outright.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}
