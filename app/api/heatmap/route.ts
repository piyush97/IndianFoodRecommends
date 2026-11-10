import { db } from "../../../db";
import { cityBySlug } from "../../../lib/cities";
import { getHeatmap } from "../../../lib/public/spatial";
export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get("city") ?? "";
  if (!cityBySlug(city)) return Response.json({ error: "Unknown city." }, { status: 400 });
  try {
    return Response.json(await getHeatmap(db, city), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("heatmap", error);
    return Response.json({ error: "Food density is temporarily unavailable." }, { status: 503 });
  }
}
