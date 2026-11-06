import { describe, expect, it } from "vitest";
import { dishItemList, restaurantLd, serializeJsonLd } from "./jsonld";
import { SITE_URL, absoluteUrl } from "./site";

describe("absoluteUrl", () => {
  it("prefixes the site origin", () => {
    expect(absoluteUrl("/delhi")).toBe(`${SITE_URL}/delhi`);
    expect(SITE_URL.endsWith("/")).toBe(false);
  });
});

describe("serializeJsonLd", () => {
  it("cannot close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><b>x</b>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
    expect(JSON.parse(out)).toEqual({ name: "</script><b>x</b>" });
  });
});

describe("dishItemList", () => {
  it("numbers places from 1 with absolute urls", () => {
    const ld = dishItemList({
      city: "Delhi",
      dish: "Chole Bhature",
      path: "/delhi/chole-bhature",
      places: [
        { name: "A", path: "/delhi/place/a" },
        { name: "B", path: "/delhi/place/b" },
      ],
    }) as { itemListElement: { position: number; url: string; name: string }[]; name: string };
    expect(ld.name).toBe("Chole Bhature in Delhi");
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, url: `${SITE_URL}/delhi/place/a`, name: "A" },
      { "@type": "ListItem", position: 2, url: `${SITE_URL}/delhi/place/b`, name: "B" },
    ]);
  });
});

describe("restaurantLd", () => {
  const base = {
    name: "Chache Di Hatti",
    path: "/delhi/place/chache-di-hatti",
    locality: "Kamla Nagar",
    city: "Delhi",
    dishes: ["Chole Bhature"],
  };

  it("omits geo without coordinates", () => {
    const ld = restaurantLd({ ...base, lat: null, lng: null }) as Record<string, unknown>;
    expect(ld).not.toHaveProperty("geo");
    expect(ld).toMatchObject({
      "@type": "Restaurant",
      url: `${SITE_URL}/delhi/place/chache-di-hatti`,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kamla Nagar",
        addressRegion: "Delhi",
        addressCountry: "IN",
      },
    });
  });

  it("adds geo when coordinates exist", () => {
    const ld = restaurantLd({ ...base, lat: 28.68, lng: 77.21 }) as Record<string, unknown>;
    expect(ld.geo).toEqual({ "@type": "GeoCoordinates", latitude: 28.68, longitude: 77.21 });
  });
});
