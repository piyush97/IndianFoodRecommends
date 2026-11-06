import type { PickCard } from "../lib/public/queries";

export type MapPoint = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  approx: boolean;
  /** Position in the ranked list, so the pin and the row share a number. */
  rank?: number;
};

/** Places without coordinates get no pin. */
export function mapPoints(cards: PickCard[]): MapPoint[] {
  return cards.flatMap((c, i) =>
    c.lat === null || c.lng === null
      ? []
      : [
          {
            slug: c.placeSlug,
            name: c.placeName,
            lat: c.lat,
            lng: c.lng,
            approx: c.approx,
            rank: i + 1,
          },
        ],
  );
}
