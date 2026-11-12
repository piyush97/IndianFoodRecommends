import { NextResponse, type NextRequest } from "next/server";
import { db } from "../../../db";
import { googleRating } from "../../../lib/google-rating";
import { clientKey, takeToken } from "../../../lib/rate-limit";

// Each answer is a paid Google call, so crawlers get nothing.
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i;
const SLUG = /^[a-z0-9-]{1,120}$/;

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("place") ?? "";
  if (!SLUG.test(slug)) return NextResponse.json({ error: "Bad place" }, { status: 400 });
  if (BOT.test(request.headers.get("user-agent") ?? ""))
    return new NextResponse(null, { status: 204 });
  // Per-client budget in Postgres so one visitor cannot drain the paid Google quota.
  const limit = await takeToken(db, clientKey(request, "rating"), {
    capacity: 30,
    refillPerSecond: 30 / 60,
  });
  if (!limit.ok)
    return new NextResponse(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)),
      },
    });
  const rating = await googleRating(db, slug);
  // Google's terms forbid caching ratings, so neither the CDN nor the browser keeps this.
  const headers = { "cache-control": "no-store" };
  if (!rating) return new NextResponse(null, { status: 204, headers });
  return NextResponse.json(rating, { headers });
}
