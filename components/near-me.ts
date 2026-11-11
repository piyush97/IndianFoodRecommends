import type { PickCard } from "../lib/public/queries";

export type Point = { lat: number; lng: number };

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Nearest first; places without a map pin keep their rank order at the end. */
export function sortByDistance(cards: PickCard[], origin: Point): PickCard[] {
  const located = cards
    .filter((c) => c.lat !== null && c.lng !== null)
    .map((c) => ({ c, km: haversineKm(origin, { lat: c.lat!, lng: c.lng! }) }))
    .sort((x, y) => x.km - y.km)
    .map((x) => x.c);
  const rest = cards.filter((c) => c.lat === null || c.lng === null);
  return [...located, ...rest];
}

const NEAR_KM = 5;
const FAR_KM = 50;
const BAND_KM = 0.5;

export type NearMeResult = { mode: "near" | "far" | "none"; cards: (PickCard & { km: number })[] };

/**
 * Picks to show around a point: within 5 km, banded by 500 m (nearer band first), more creators
 * first inside a band, top 10. With nothing within 5 km, the 5 nearest if the closest is under 50 km.
 */
export function nearMe(cards: PickCard[], origin: Point): NearMeResult {
  const located = cards
    .filter((c) => c.lat !== null && c.lng !== null)
    .map((c) => ({ ...c, km: haversineKm(origin, { lat: c.lat!, lng: c.lng! }) }))
    .sort((a, b) => a.km - b.km);
  const near = located.filter((c) => c.km <= NEAR_KM);
  if (near.length > 0) {
    const banded = near.sort(
      (a, b) =>
        Math.floor(a.km / BAND_KM) - Math.floor(b.km / BAND_KM) ||
        b.creators.length - a.creators.length ||
        a.km - b.km,
    );
    return { mode: "near", cards: banded.slice(0, 10) };
  }
  if (located.length > 0 && located[0].km < FAR_KM)
    return { mode: "far", cards: located.slice(0, 5) };
  return { mode: "none", cards: [] };
}
