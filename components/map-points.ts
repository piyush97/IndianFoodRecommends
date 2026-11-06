import type { PickCard } from "../lib/public/queries";

export type MapPoint = { slug: string; name: string; lat: number; lng: number; approx: boolean };

/** Places without coordinates stay in the list but get no pin. */
export function mapPoints(cards: PickCard[]): MapPoint[] {
  return cards.flatMap((c) =>
    c.lat === null || c.lng === null
      ? []
      : [{ slug: c.placeSlug, name: c.placeName, lat: c.lat, lng: c.lng, approx: c.approx }],
  );
}
