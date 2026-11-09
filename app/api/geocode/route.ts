import { NextResponse, type NextRequest } from "next/server";
import { db } from "../../../db";
import { findArea, UpstreamBusy } from "../../../lib/geocode-area";
import { suggestLocation } from "../../../lib/review";

// OpenStreetMap allows one search a second, so an instance calls it at most once a second.
// Answers from our own area list never reach this, and repeat searches come from the CDN cache.
let busyUntil = 0;
async function upstream(query: string) {
  if (Date.now() < busyUntil) throw new UpstreamBusy();
  busyUntil = Date.now() + 1000;
  return suggestLocation(query);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const area = await findArea(
    db,
    searchParams.get("city") ?? "",
    searchParams.get("q") ?? "",
    upstream,
  );
  if (!area.ok) {
    return NextResponse.json(
      { error: area.error, suggestions: area.suggestions },
      { status: area.status, headers: area.status === 429 ? { "retry-after": "2" } : undefined },
    );
  }
  return NextResponse.json(
    { lat: area.lat, lng: area.lng, label: area.label, via: area.via },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
