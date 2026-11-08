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
