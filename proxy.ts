import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { db } from "./db";
import { isKnownPath, loadIndex, type PathIndex } from "./lib/seo/known-paths";

// Next serves 200 when notFound() fires inside streamed content, so unknown slugs are
// answered here, before rendering starts. Every failure path lets the request through.
const TTL_MS = 60_000;
const RETRY_MS = 10_000;
let cached: { at: number; index: PathIndex } | null = null;
let loading: Promise<PathIndex | null> | null = null;

// One load at a time, shared by every request that needs it. A failure keeps the previous index.
function refresh(): Promise<PathIndex | null> {
  const at = Date.now();
  loading ??= loadIndex(db)
    .then(
      (index) => (cached = { at, index }).index,
      (error) => {
        console.error("proxy: slug index failed, letting the request through", error);
        return cached?.index ?? null;
      },
    )
    .finally(() => {
      loading = null;
    });
  return loading;
}

async function index(force: boolean): Promise<PathIndex | null> {
  if (cached && Date.now() - cached.at < (force ? RETRY_MS : TTL_MS)) return cached.index;
  return refresh();
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  let segments: string[];
  try {
    segments = request.nextUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return NextResponse.rewrite(new URL("/404", request.url), { status: 404 }); // malformed %-escape
  }
  // An expired index still vouches for the pages it lists: answer now, refresh after the response.
  if (cached && Date.now() - cached.at >= TTL_MS && isKnownPath(segments, cached.index)) {
    event.waitUntil(refresh());
    return NextResponse.next();
  }
  let known = await index(false);
  if (!known) return NextResponse.next();
  // A new page can appear between refreshes; recheck once before answering 404.
  if (!isKnownPath(segments, known)) known = await index(true);
  if (!known || isKnownPath(segments, known)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
}

export const config = { matcher: ["/((?!_next/|api/|admin|.*\\..*).*)"] };
