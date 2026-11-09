import { db } from "../../../../../../db";
import { cityBySlug } from "../../../../../../lib/cities";
import {
  parseTileCoordinates,
  pickTile,
  readMapFilter,
} from "../../../../../../lib/public/spatial";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await params;
  const coordinates = parseTileCoordinates(z, x, y);
  const query = new URL(request.url).searchParams;
  const city = query.get("city") ?? "";
  const filter = readMapFilter(query);
  if (!coordinates || !cityBySlug(city) || !filter)
    return Response.json({ error: "Invalid tile or city." }, { status: 400 });
  try {
    return new Response(new Uint8Array(await pickTile(db, city, coordinates, filter)), {
      headers: {
        "Content-Type": "application/vnd.mapbox-vector-tile",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("pick tile", error);
    return Response.json({ error: "Could not load map picks." }, { status: 503 });
  }
}
