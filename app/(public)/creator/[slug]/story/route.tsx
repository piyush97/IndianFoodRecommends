import { connection } from "next/server";
import { storyCard, storyLines } from "../../../../../lib/seo/story";
import { cachedCreator } from "../../../data";

/** 1080x1920 story image creators download from their kit page. */
export async function GET(_request: Request, ctx: RouteContext<"/creator/[slug]/story">) {
  await connection();
  const { slug } = await ctx.params;
  const data = await cachedCreator(slug).catch(() => null);
  if (!data || data.picks.length === 0) return new Response("Not found", { status: 404 });
  try {
    const image = await storyCard(storyLines(data));
    // Buffer so render errors (emoji glyph fetch offline) surface here, not mid-stream.
    const body = await image.arrayBuffer();
    return new Response(body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, s-maxage=3600, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new Response("Story image unavailable, try again later", { status: 503 });
  }
}
