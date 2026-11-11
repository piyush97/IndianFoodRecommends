import type { NextRequest } from "next/server";
import { cachedList } from "../../../(public)/data";
import { creatorCount, parseListParam } from "../../../../lib/list-params";
import { ogCard } from "../../../../lib/seo/og";

const HIT = "public, s-maxage=86400, stale-while-revalidate=604800";

async function fallback(cache: string) {
  const res = await ogCard({
    title: "Where Indian food vloggers say to eat",
    subline: "Places ranked by how many creators picked them, with the video moment",
  });
  res.headers.set("cache-control", cache);
  return res;
}

/** Preview card for a shared list. `p` is user input: bad or missing slugs fall back to the default card. */
export async function GET(request: NextRequest) {
  const slugs = parseListParam(request.nextUrl.searchParams.get("p") ?? undefined);
  if (slugs.length === 0) return fallback(HIT);
  try {
    const cards = await cachedList(slugs);
    if (cards.length === 0) return fallback(HIT);
    const res = await ogCard({
      title: `${cards.length} ${cards.length === 1 ? "place" : "places"} to eat`,
      subline: cards
        .slice(0, 5)
        .map((c) => c.placeName)
        .join(" · "),
      lid: {
        city: cards[0].citySlug,
        count: creatorCount(cards),
        label: creatorCount(cards) === 1 ? "vlogger" : "vloggers",
      },
    });
    res.headers.set("cache-control", HIT);
    return res;
  } catch (error) {
    console.error("og list", error);
    return fallback("public, s-maxage=60");
  }
}
