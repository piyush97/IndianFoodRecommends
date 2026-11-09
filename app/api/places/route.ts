import { db } from "../../../db";
import { cityBySlug } from "../../../lib/cities";
import { getSpatialPicks, parseBounds, readMapFilter } from "../../../lib/public/spatial";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const bbox = parseBounds(params.get("bbox"));
  const filter = readMapFilter(params);
  if (!cityBySlug(city) || !bbox || !filter)
    return Response.json({ error: "Choose a valid city and bounding box." }, { status: 400 });
  try {
    const cards = await getSpatialPicks(db, city, {
      bbox,
      diet: filter.diet,
      ...(filter.dish && { dishes: [filter.dish] }),
      ...(filter.area && { area: filter.area }),
    });
    return Response.json(
      { cards, limit: 300 },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("viewport search", error);
    return Response.json({ error: "Could not search this area. Please retry." }, { status: 503 });
  }
}
