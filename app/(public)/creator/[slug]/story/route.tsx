import { connection } from "next/server";
import { storyCard, storyLines } from "../../../../../lib/seo/story";
import { cachedCreator } from "../../../data";

/** 1080x1920 story image creators download from their kit page. */
export async function GET(_request: Request, ctx: RouteContext<"/creator/[slug]/story">) {
  await connection();
  const { slug } = await ctx.params;
  const data = await cachedCreator(slug).catch(() => null);
  if (!data || data.picks.length === 0) return new Response("Not found", { status: 404 });
  const image = await storyCard(storyLines(data));
  image.headers.set("cache-control", "public, s-maxage=86400");
  return image;
}
