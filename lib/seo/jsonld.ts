import { absoluteUrl } from "./site";

/** Next.js JSON-LD guide: escape `<` so DB strings cannot end the script tag. */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function dishItemList(input: {
  city: string;
  dish: string;
  path: string;
  places: { name: string; path: string }[];
}): object {
  return placeItemList({ ...input, name: `${input.dish} in ${input.city}` });
}

export function placeItemList(input: {
  name: string;
  path: string;
  places: { name: string; path: string }[];
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    url: absoluteUrl(input.path),
    itemListElement: input.places.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(p.path),
      name: p.name,
    })),
  };
}

export function restaurantLd(input: {
  name: string;
  path: string;
  locality: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  dishes: string[];
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: input.name,
    url: absoluteUrl(input.path),
    address: {
      "@type": "PostalAddress",
      ...(input.locality && { addressLocality: input.locality }),
      addressRegion: input.city,
      addressCountry: "IN",
    },
    ...(input.lat !== null &&
      input.lng !== null && {
        geo: { "@type": "GeoCoordinates", latitude: input.lat, longitude: input.lng },
      }),
    ...(input.dishes.length > 0 && {
      hasMenu: {
        "@type": "Menu",
        hasMenuSection: {
          "@type": "MenuSection",
          name: "Recommended by food vloggers",
          hasMenuItem: input.dishes.map((name) => ({ "@type": "MenuItem", name })),
        },
      },
    }),
  };
}
