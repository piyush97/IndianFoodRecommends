import { NextResponse, type NextRequest } from "next/server";
import { db } from "./db";
import { isKnownPath, loadIndex, type PathIndex } from "./lib/seo/known-paths";

// Next serves 200 when notFound() fires inside streamed content, so unknown slugs are
// answered here, before rendering starts. Every failure path lets the request through.
const TTL_MS = 60_000;
const RETRY_MS = 10_000;
let cached: { at: number; index: PathIndex } | null = null;

async function index(force: boolean): Promise<PathIndex | null> {
  const now = Date.now();
  if (cached && !force && now - cached.at < TTL_MS) return cached.index;
  if (cached && force && now - cached.at < RETRY_MS) return cached.index;
  try {
    cached = { at: now, index: await loadIndex(db) };
    return cached.index;
  } catch (error) {
    console.error("proxy: slug index failed, letting the request through", error);
    return cached?.index ?? null;
  }
}

export async function proxy(request: NextRequest) {
  let segments: string[];
  try {
    segments = request.nextUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return NextResponse.rewrite(new URL("/404", request.url), { status: 404 }); // malformed %-escape
  }
  let known = await index(false);
  if (!known) return NextResponse.next();
  // A new page can appear between refreshes; recheck once before answering 404.
  if (!isKnownPath(segments, known)) known = await index(true);
  if (!known || isKnownPath(segments, known)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
}

export const config = { matcher: ["/((?!_next/|api/|admin|.*\\..*).*)"] };
