import { describe, expect, it } from "vitest";
import { matchOsm, parseOverpass, weekSchedule, type OsmFood } from "./opening-hours";

const at = (local: string) => new Date(`${local}+05:30`);
const from = at("2026-11-16T12:00:00");

describe("weekSchedule", () => {
  it("turns a weekday range into Monday-first intervals", () => {
    expect(weekSchedule("Mo-Su 08:00-23:00", from)).toEqual(
      Array.from({ length: 7 }, () => [[480, 1380]]),
    );
  });

  it("keeps a past-midnight close after 1440", () => {
    expect(weekSchedule("Mo-Su 18:00-02:00", from)?.[0]).toEqual([[1080, 1560]]);
  });

  it("marks 24/7 as a full day every day", () => {
    expect(weekSchedule("24/7", from)).toEqual(Array.from({ length: 7 }, () => [[0, 1440]]));
  });

  it("returns null for an unparseable or empty tag", () => {
    expect(weekSchedule("garbage ;;", from)).toBeNull();
    expect(weekSchedule("   ", from)).toBeNull();
    expect(weekSchedule("Mo-Su sunrise-sunset", from)).toBeNull();
  });
});

describe("parseOverpass", () => {
  it("reads nodes and way centers, skipping unnamed or hourless elements", () => {
    const json = {
      elements: [
        {
          type: "node",
          id: 1,
          lat: 28.68,
          lon: 77.2,
          tags: { name: "Node Cafe", opening_hours: "Mo-Su 09:00-22:00" },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 28.69, lon: 77.21 },
          tags: { name: "Way Cafe", opening_hours: "24/7" },
        },
        { type: "node", id: 3, lat: 28.7, lon: 77.22, tags: { name: "No Hours" } },
        { type: "node", id: 4, lat: 28.7, lon: 77.22, tags: { opening_hours: "24/7" } },
      ],
    };
    expect(parseOverpass(json)).toEqual([
      { id: 1, name: "Node Cafe", lat: 28.68, lng: 77.2, openingHours: "Mo-Su 09:00-22:00" },
      { id: 2, name: "Way Cafe", lat: 28.69, lng: 77.21, openingHours: "24/7" },
    ]);
  });
});

const candidate = (overrides: Partial<OsmFood> = {}): OsmFood => ({
  id: 10,
  name: "Chache Di Hatti",
  lat: 28.68,
  lng: 77.2,
  openingHours: "Mo-Su 08:00-23:00",
  ...overrides,
});

const place = { name: "Chache Di Hatti", lat: 28.68, lng: 77.2, osmId: "999" };

describe("matchOsm", () => {
  it("matches by numeric OSM id", () => {
    expect(matchOsm({ ...place, osmId: "10" }, [candidate({ lat: 28.7 })])?.id).toBe(10);
  });

  it("matches 100 m away when the name is the same", () => {
    expect(matchOsm(place, [candidate({ lat: 28.6809 })])?.id).toBe(10);
  });

  it("rejects 100 m away with a different name", () => {
    expect(matchOsm(place, [candidate({ lat: 28.6809, name: "Burger King" })])).toBeNull();
  });

  it("rejects 300 m away even with the same name", () => {
    expect(matchOsm(place, [candidate({ lat: 28.6827 })])).toBeNull();
  });

  it("takes the nearest when several qualify", () => {
    const near = candidate({ id: 11, lat: 28.6805 });
    const far = candidate({ id: 12, lat: 28.6812 });
    expect(matchOsm(place, [far, near])?.id).toBe(11);
  });
});
