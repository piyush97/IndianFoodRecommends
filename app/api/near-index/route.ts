import { cachedAllCards } from "../../(public)/data";

// Same cards as the lists, nothing per-visitor: coordinates are matched on the device.
export async function GET() {
  try {
    return Response.json(
      { cards: await cachedAllCards() },
      { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("near-index", error);
    return Response.json({ error: "Could not load picks. Try again." }, { status: 503 });
  }
}
