import { normalizeName } from "./text";

export type City = { slug: string; name: string; state: string; aliases: string[] };

/** The only place a city is defined. Order = display order. */
export const CITIES: readonly City[] = [
  {
    slug: "delhi",
    name: "Delhi",
    state: "Delhi",
    aliases: [
      "new delhi",
      "old delhi",
      "delhi ncr",
      "ncr",
      "gurgaon",
      "gurugram",
      "noida",
      "greater noida",
      "faridabad",
      "ghaziabad",
    ],
  },
  {
    slug: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    aliases: ["bombay", "navi mumbai", "thane"],
  },
  {
    slug: "kolkata",
    name: "Kolkata",
    state: "West Bengal",
    aliases: ["calcutta", "howrah", "salt lake", "new town"],
  },
  {
    slug: "hyderabad",
    name: "Hyderabad",
    state: "Telangana",
    aliases: ["secunderabad", "cyberabad", "hitec city", "gachibowli", "madhapur", "kondapur"],
  },
  {
    slug: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    aliases: ["bangalore", "bengaluru urban", "bangalore urban"],
  },
  {
    slug: "chennai",
    name: "Chennai",
    state: "Tamil Nadu",
    aliases: ["madras", "tambaram"],
  },
  {
    slug: "lucknow",
    name: "Lucknow",
    state: "Uttar Pradesh",
    aliases: [],
  },
  {
    slug: "jaipur",
    name: "Jaipur",
    state: "Rajasthan",
    aliases: ["pink city"],
  },
];

const BY_NAME = new Map<string, City>(
  CITIES.flatMap((c) => [
    [normalizeName(c.name), c] as const,
    ...c.aliases.map((a) => [a, c] as const),
  ]),
);

/** Exact match on the city name or a known alias; never a substring guess. */
export function cityFromName(name: string | null | undefined): City | null {
  if (!name) return null;
  return BY_NAME.get(normalizeName(name)) ?? null;
}

export function cityBySlug(slug: string): City | null {
  return CITIES.find((c) => c.slug === slug) ?? null;
}
