import { connection } from "next/server";
import { badgeSvg } from "../../../../../lib/badge";
import { cachedCreator } from "../../../data";

/** Embeddable SVG badge: `<img src="/creator/{slug}/badge">`. */
export async function GET(_request: Request, ctx: RouteContext<"/creator/[slug]/badge">) {
  await connection();
  const { slug } = await ctx.params;
  const data = await cachedCreator(slug).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(badgeSvg({ name: data.creator.name, picks: data.total }), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
      // Shown on other sites: block scripts inside the SVG outright.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}
