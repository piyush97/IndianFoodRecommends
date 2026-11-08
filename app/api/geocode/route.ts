import { NextResponse, type NextRequest } from "next/server";
import { db } from "../../../db";
import { findArea } from "../../../lib/geocode-area";

// OpenStreetMap allows one search a second, so an instance answers one lookup per second.
// Repeat searches are served from the CDN cache and never reach this.
let busyUntil = 0;

export async function GET(request: NextRequest) {
  if (Date.now() < busyUntil) {
    return NextResponse.json(
      { error: "Too many searches at once. Try again in a few seconds." },
      { status: 429, headers: { "retry-after": "2" } },
    );
  }
  busyUntil = Date.now() + 1000;
  const { searchParams } = request.nextUrl;
  const area = await findArea(db, searchParams.get("city") ?? "", searchParams.get("q") ?? "");
  if (!area.ok) return NextResponse.json({ error: area.error }, { status: area.status });
  return NextResponse.json(
    { lat: area.lat, lng: area.lng, label: area.label },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
