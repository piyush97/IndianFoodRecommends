import { eq } from "drizzle-orm";
import { schema, type Db } from "../db";
import { haversineKm } from "../components/near-me";
import { normalizeName } from "./text";

export type GoogleRating = { rating: number; count: number; url: string };

type Deps = { apiKey?: string; fetchImpl?: typeof fetch };

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
};

const API = "https://places.googleapis.com/v1";
const RATING_FIELDS = ["rating", "userRatingCount", "googleMapsUri"];

/** Same shop if one name contains the other with spaces dropped, or half our words appear. */
export function sameName(ours: string, theirs: string): boolean {
  const a = normalizeName(ours);
  const b = normalizeName(theirs);
  if (!a || !b) return false;
  const [ca, cb] = [a.replace(/ /g, ""), b.replace(/ /g, "")];
  if (ca.includes(cb) || cb.includes(ca)) return true;
  const words = new Set(b.split(" "));
  const ourWords = a.split(" ").filter((w) => w.length > 1);
  return ourWords.filter((w) => words.has(w)).length * 2 >= ourWords.length;
}

function toRating(p: GooglePlace): GoogleRating | null {
  if (typeof p.rating !== "number" || !p.googleMapsUri) return null;
  return { rating: p.rating, count: p.userRatingCount ?? 0, url: p.googleMapsUri };
}

/**
 * Live Google rating for one of our places. Google's terms forbid storing ratings, so this calls
 * the Places API on every use; only the place ID is kept. Unset key, unknown place, no confident
 * match or an API error all give null, and the page shows no rating.
 */
export async function googleRating(
  db: Db,
  placeSlug: string,
  { apiKey = process.env.GOOGLE_MAPS_API_KEY, fetchImpl = fetch }: Deps = {},
): Promise<GoogleRating | null> {
  if (!apiKey) return null;
  const [place] = await db
    .select({
      id: schema.places.id,
      name: schema.places.name,
      locality: schema.places.locality,
      lat: schema.places.lat,
      lng: schema.places.lng,
      osmId: schema.places.osmId,
      googlePlaceId: schema.places.googlePlaceId,
      city: schema.cities.name,
    })
    .from(schema.places)
    .innerJoin(schema.cities, eq(schema.cities.id, schema.places.cityId))
    .where(eq(schema.places.slug, placeSlug));
  if (!place || place.googlePlaceId === "none") return null;
  const headers = { "x-goog-api-key": apiKey, "content-type": "application/json" };

  if (place.googlePlaceId) {
    const res = await fetchImpl(`${API}/places/${encodeURIComponent(place.googlePlaceId)}`, {
      headers: { ...headers, "x-goog-fieldmask": RATING_FIELDS.join(",") },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("google rating: details failed", res.status);
      return null;
    }
    return toRating((await res.json()) as GooglePlace);
  }

  // First use: find the shop by name near our pin, and keep its ID if it is clearly the same one.
  const hasPin = place.lat !== null && place.lng !== null;
  const res = await fetchImpl(`${API}/places:searchText`, {
    method: "POST",
    headers: {
      ...headers,
      "x-goog-fieldmask": ["id", "displayName", "location", ...RATING_FIELDS]
        .map((f) => `places.${f}`)
        .join(","),
    },
    body: JSON.stringify({
      textQuery: [place.name, place.locality, place.city].filter(Boolean).join(", "),
      maxResultCount: 1,
      regionCode: "IN",
      languageCode: "en",
      ...(hasPin && {
        locationBias: {
          circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 5000 },
        },
      }),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("google rating: search failed", res.status);
    return null;
  }
  const hit = ((await res.json()) as { places?: GooglePlace[] }).places?.[0];
  const { latitude, longitude } = hit?.location ?? {};
  // Neighbourhood-level pins sit up to a few km from the shop.
  const maxKm = place.osmId?.startsWith("approx:") ? 10 : 2;
  const near =
    !hasPin ||
    (latitude !== undefined &&
      longitude !== undefined &&
      haversineKm({ lat: place.lat!, lng: place.lng! }, { lat: latitude, lng: longitude }) <=
        maxKm);
  const match = hit?.id && near && sameName(place.name, hit.displayName?.text ?? "");
  await db
    .update(schema.places)
    .set({ googlePlaceId: match ? hit.id : "none" })
    .where(eq(schema.places.id, place.id));
  return match ? toRating(hit) : null;
}
