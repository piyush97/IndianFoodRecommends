import { describe, expect, it } from "vitest";
import {
  directionsUrl,
  formatTs,
  googleMapsUrl,
  sourceUrl,
  swiggyUrl,
  youtubeEmbedUrl,
  zomatoUrl,
} from "./links";

describe("app links", () => {
  it("searches Google Maps by name, exact with a place ID", () => {
    expect(googleMapsUrl("Chache Di Hatti", "Kamla Nagar, Delhi")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Chache%20Di%20Hatti%2C%20Kamla%20Nagar%2C%20Delhi",
    );
    expect(googleMapsUrl("A&B", "Delhi", "ChIJ1")).toMatch(
      /query=A%26B%2C%20Delhi&query_place_id=ChIJ1$/,
    );
  });

  it("finds the Zomato page through a site search and searches Swiggy by name", () => {
    expect(zomatoUrl("Chache Di Hatti", "Delhi")).toBe(
      "https://www.google.com/search?q=Chache%20Di%20Hatti%20Delhi%20site%3Azomato.com",
    );
    expect(swiggyUrl("Chache Di Hatti")).toBe(
      "https://www.swiggy.com/search?query=Chache%20Di%20Hatti",
    );
  });
});

describe("directionsUrl", () => {
  const place = { name: "Chache Di Hatti", locality: "Kamla Nagar", city: "Delhi" };
  const base = "https://www.google.com/maps/dir/?api=1&destination=";

  it("uses coordinates for an exact pin", () => {
    expect(directionsUrl({ ...place, lat: 28.6, lng: 77.2, approx: false })).toBe(
      `${base}28.6,77.2`,
    );
  });

  it("uses the name for an approximate pin even when coordinates exist", () => {
    expect(directionsUrl({ ...place, lat: 28.6, lng: 77.2, approx: true })).toBe(
      `${base}Chache%20Di%20Hatti%2C%20Kamla%20Nagar%2C%20Delhi`,
    );
  });

  it("uses the name when a coordinate is missing", () => {
    const byName = `${base}Chache%20Di%20Hatti%2C%20Kamla%20Nagar%2C%20Delhi`;
    expect(directionsUrl({ ...place, lat: null, lng: 77.2, approx: false })).toBe(byName);
    expect(directionsUrl({ ...place, lat: 28.6, lng: null, approx: false })).toBe(byName);
  });

  it("drops a missing locality", () => {
    expect(directionsUrl({ ...place, locality: null, lat: null, lng: null, approx: false })).toBe(
      `${base}Chache%20Di%20Hatti%2C%20Delhi`,
    );
  });

  it("encodes & and , in the name", () => {
    expect(
      directionsUrl({ ...place, name: "A&B, Sweets", lat: null, lng: null, approx: false }),
    ).toBe(`${base}A%26B%2C%20Sweets%2C%20Kamla%20Nagar%2C%20Delhi`);
  });
});

describe("youtubeEmbedUrl", () => {
  it("starts at the timestamp on the privacy domain", () => {
    expect(youtubeEmbedUrl("abc", 252)).toBe(
      "https://www.youtube-nocookie.com/embed/abc?start=252",
    );
  });

  it("omits start without a timestamp", () => {
    expect(youtubeEmbedUrl("abc", null)).toBe("https://www.youtube-nocookie.com/embed/abc");
  });
});

describe("sourceUrl", () => {
  it("links to the YouTube moment", () => {
    expect(sourceUrl("youtube", "abc", 252)).toBe("https://www.youtube.com/watch?v=abc&t=252s");
  });

  it("links to the Instagram reel", () => {
    expect(sourceUrl("instagram", "C9x", null)).toBe("https://www.instagram.com/reel/C9x/");
  });
});

describe("formatTs", () => {
  it.each([
    [252, "4:12"],
    [3725, "1:02:05"],
    [5, "0:05"],
  ])("%i seconds is %s", (s, out) => {
    expect(formatTs(s)).toBe(out);
  });

  it("is null without a timestamp", () => {
    expect(formatTs(null)).toBeNull();
  });
});
