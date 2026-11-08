import { NextResponse, type NextRequest } from "next/server";
import { db } from "../../../db";
import { googleRating } from "../../../lib/google-rating";

// Each answer is a paid Google call, so crawlers get nothing.
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i;
const SLUG = /^[a-z0-9-]{1,120}$/;

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("place") ?? "";
  if (!SLUG.test(slug)) return NextResponse.json({ error: "Bad place" }, { status: 400 });
  if (BOT.test(request.headers.get("user-agent") ?? ""))
    return new NextResponse(null, { status: 204 });
  const rating = await googleRating(db, slug);
  // Google's terms forbid caching ratings, so neither the CDN nor the browser keeps this.
  const headers = { "cache-control": "no-store" };
  if (!rating) return new NextResponse(null, { status: 204, headers });
  return NextResponse.json(rating, { headers });
}
