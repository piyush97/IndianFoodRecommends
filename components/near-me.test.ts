import { describe, expect, it } from "vitest";
import type { PickCard } from "../lib/public/queries";
import { haversineKm, sortByDistance } from "./near-me";

const CP = { lat: 28.6315, lng: 77.2167 }; // Connaught Place
const GURGAON = { lat: 28.4595, lng: 77.0266 };

const card = (slug: string, lat: number | null, lng: number | null): PickCard => ({
  citySlug: "delhi",
  placeSlug: slug,
  placeName: slug,
  locality: null,
  lat,
  lng,
  approx: false,
  creators: [],
  dishes: [],
  proof: { platform: "youtube", externalId: "x", tsSeconds: null, creator: "c" },
  score: 0,
  pickedOn: "2026-01-01",
});

describe("haversineKm", () => {
  it("measures Connaught Place to Gurgaon at about 26 km", () => {
    const km = haversineKm(CP, GURGAON);
    expect(km).toBeGreaterThan(24);
    expect(km).toBeLessThan(30);
  });

  it("is zero for the same point", () => {
    expect(haversineKm(CP, CP)).toBe(0);
  });
});

describe("sortByDistance", () => {
  it("puts the nearest first and places without coordinates last, in rank order", () => {
    const cards = [
      card("no-coords-1", null, null),
      card("gurgaon", GURGAON.lat, GURGAON.lng),
      card("no-coords-2", 28.5, null),
      card("cp", CP.lat, CP.lng),
    ];
    expect(sortByDistance(cards, CP).map((c) => c.placeSlug)).toEqual([
      "cp",
      "gurgaon",
      "no-coords-1",
      "no-coords-2",
    ]);
  });

  it("does not mutate the input", () => {
    const cards = [card("a", GURGAON.lat, GURGAON.lng), card("b", CP.lat, CP.lng)];
    sortByDistance(cards, CP);
    expect(cards.map((c) => c.placeSlug)).toEqual(["a", "b"]);
  });
});
