import { describe, expect, it } from "vitest";
import type { PickCard } from "../lib/public/queries";
import { mapPoints } from "./map-points";

const card = (slug: string, lat: number | null, lng: number | null, approx = false): PickCard => ({
  citySlug: "delhi",
  placeSlug: slug,
  placeName: slug.toUpperCase(),
  locality: null,
  lat,
  lng,
  approx,
  creators: [],
  dishes: [],
  proof: { platform: "youtube", externalId: "x", tsSeconds: null, creator: "c" },
  score: 0,
});

describe("mapPoints", () => {
  it("drops places without coordinates and keeps the approx flag", () => {
    expect(
      mapPoints([card("b", null, null), card("a", 28.6, 77.2, true), card("c", 28.7, null)]),
    ).toEqual([{ slug: "a", name: "A", lat: 28.6, lng: 77.2, approx: true, rank: 2 }]);
  });
});
