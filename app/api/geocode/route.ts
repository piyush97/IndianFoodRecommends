import { NextResponse, type NextRequest } from "next/server";
import { db } from "../../../db";
import { findArea, UpstreamBusy } from "../../../lib/geocode-area";
import { suggestLocation } from "../../../lib/review";
import { clientKey, takeToken } from "../../../lib/rate-limit";
import { withSpan } from "../../../lib/tracing";

// OpenStreetMap allows one search a second, so an instance calls it at most once a second.
// Answers from our own area list never reach this, and repeat searches come from the CDN cache.
let busyUntil = 0;
async function upstream(query: string) {
  if (Date.now() < busyUntil) throw new UpstreamBusy();
  busyUntil = Date.now() + 1000;
  // The upstream call is the slow, rate-limited boundary worth tracing.
  return withSpan("nominatim.search", () => suggestLocation(query), { "geocode.query": query });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Per-client budget in Postgres, so it holds across cold starts. The
  // one-per-second guard below still protects the Nominatim upstream itself.
  const limit = await takeToken(db, clientKey(request, "geocode"), {
    capacity: 10,
    refillPerSecond: 10 / 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate", message: "Too many location lookups. Try again in a moment." },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }
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
