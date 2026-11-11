import { connection } from "next/server";
import { cachedAllCards } from "../../(public)/data";

// Same cards as the lists, nothing per-visitor: coordinates are matched on the device.
export async function GET() {
  // Request time only: a build must never need the database or bake the index into the output.
  await connection();
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
