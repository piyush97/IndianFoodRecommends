import { describe, expect, it } from "vitest";
import type { PickCard } from "../lib/public/queries";
import { haversineKm, nearMe, sortByDistance } from "./near-me";

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

describe("nearMe", () => {
  const o = { lat: 28.6562, lng: 77.2303 }; // Chandni Chowk
  const at = (slug: string, lat: number, lng: number, n = 1): PickCard => ({
    ...card(slug, lat, lng),
    creators: Array.from({ length: n }, (_, i) => ({ slug: `c${i}`, name: "" })),
  });

  it("bands then creators", () => {
    const r = nearMe(
      [
        at("far1", 28.66, 77.2303, 1),
        at("close1", 28.6563, 77.2303, 1),
        at("close3", 28.658, 77.2303, 3),
      ],
      o,
    );
    expect(r.mode).toBe("near");
    expect(r.cards.map((c) => c.placeSlug)).toEqual(["close3", "close1", "far1"]);
  });

  it("puts a nearer 500 m band before more creators", () => {
    const r = nearMe([at("band2", 28.6662, 77.2303, 5), at("band0", 28.6563, 77.2303, 1)], o);
    expect(r.cards.map((c) => c.placeSlug)).toEqual(["band0", "band2"]);
  });

  it("far mode under 50 km shows the 5 nearest", () => {
    const r = nearMe(
      Array.from({ length: 7 }, (_, i) => at(`g${i}`, 28.4595 + i * 0.001, 77.0266)),
      o,
    );
    expect(r.mode).toBe("far");
    expect(r.cards).toHaveLength(5);
    expect(r.cards[0].placeSlug).toBe("g6");
  });

  it("none beyond 50 km", () => {
    expect(nearMe([at("mumbai", 19.07, 72.87)], o)).toEqual({ mode: "none", cards: [] });
  });

  it("ignores unpinned", () => {
    const x = { ...at("x", 0, 0), lat: null, lng: null };
    expect(nearMe([x], o).mode).toBe("none");
  });

  it("caps 10", () => {
    const cards = Array.from({ length: 15 }, (_, i) => at(`p${i}`, 28.6562 + i * 0.0001, 77.2303));
    expect(nearMe(cards, o).cards).toHaveLength(10);
  });

  it("does not read proof", () => {
    const stripped = { ...at("a", 28.6563, 77.2303), proof: undefined } as unknown as PickCard;
    expect(nearMe([stripped], o).cards).toHaveLength(1);
  });
});
