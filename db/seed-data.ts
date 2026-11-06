// Seed content for Sprint 0. Kept separate from db/seed.ts so it can be tested
// without a database. Slugs are the public URL keys: keep them stable.
export type SeedDish = {
  slug: string;
  name: string;
  cuisine: string;
  aliases?: string[];
};

export const cities = [
  { slug: "delhi", name: "Delhi", state: "Delhi" },
] as const;

export const creators = [
  {
    slug: "ayush-sapra",
    name: "Aayush Sapra",
    ytChannelId: "UC2UWtuZR3kH-5C26HVMMB6A",
    igHandle: "aayushsapra2",
  },
  // Channel IDs resolved from each @handle page and checked against the live feed.
  { slug: "delhi-food-walks", name: "Delhi Food Walks", ytChannelId: "UC2LxkEsKAr_Qrm_IKESnOnQ", igHandle: null },
  { slug: "sadi-gaddi", name: "Sadi Gaddi", ytChannelId: "UCPEaAv-_U49k7j_X0wfkNQA", igHandle: null },
  { slug: "bhooka-saand", name: "Bhooka Saand", ytChannelId: "UCv6Vt0cc-CNQrRj4yCBG9Ig", igHandle: null },
  { slug: "veggie-paaji", name: "Veggie Paaji", ytChannelId: "UCVC9JRU1JpfupKHVV0sThOg", igHandle: null },
  { slug: "foodie-incarnate", name: "Foodie Incarnate", ytChannelId: "UCMfyiLGzptAStxYf7GEIQYQ", igHandle: null },
  { slug: "dilsefoodie", name: "Dilsefoodie Official", ytChannelId: "UCxiBEi8RF-l6ib4SMDTd35w", igHandle: null },
  { slug: "the-urban-guide", name: "The Urban Guide", ytChannelId: "UCycORvCTjr7zn-fxttE81zw", igHandle: null },
];

export const dishes: SeedDish[] = [
  { slug: "chole-bhature", name: "Chole Bhature", cuisine: "Punjabi", aliases: ["chhole bhature", "chana bhatura"] },
  { slug: "butter-chicken", name: "Butter Chicken", cuisine: "Punjabi", aliases: ["murgh makhani"] },
  { slug: "rajma-chawal", name: "Rajma Chawal", cuisine: "Punjabi" },
  { slug: "paranthas", name: "Paranthas", cuisine: "North Indian", aliases: ["parathas", "paranthe"] },
  { slug: "nihari", name: "Nihari", cuisine: "Mughlai" },
  { slug: "seekh-kebab", name: "Seekh Kebab", cuisine: "Mughlai", aliases: ["kebabs"] },
  { slug: "biryani", name: "Biryani", cuisine: "Hyderabadi" },
  { slug: "gol-gappe", name: "Gol Gappe", cuisine: "Street Food", aliases: ["pani puri", "puchka", "gol gappa"] },
  { slug: "aloo-chaat", name: "Aloo Chaat", cuisine: "Street Food", aliases: ["chaat"] },
  { slug: "dahi-bhalla", name: "Dahi Bhalla", cuisine: "Street Food", aliases: ["dahi vada"] },
  { slug: "aloo-tikki", name: "Aloo Tikki", cuisine: "Street Food" },
  { slug: "samosa", name: "Samosa", cuisine: "Street Food" },
  { slug: "kachori", name: "Kachori", cuisine: "Street Food", aliases: ["kofte wali kachori"] },
  { slug: "daulat-ki-chaat", name: "Daulat ki Chaat", cuisine: "Street Food" },
  { slug: "kathi-roll", name: "Kathi Roll", cuisine: "Street Food", aliases: ["rolls", "egg roll"] },
  { slug: "momos", name: "Momos", cuisine: "Indo-Chinese", aliases: ["momo"] },
  { slug: "chilli-chicken", name: "Chilli Chicken", cuisine: "Indo-Chinese" },
  { slug: "hakka-noodles", name: "Hakka Noodles", cuisine: "Indo-Chinese", aliases: ["chowmein", "chow mein"] },
  { slug: "pav-bhaji", name: "Pav Bhaji", cuisine: "Maharashtrian" },
  { slug: "vada-pav", name: "Vada Pav", cuisine: "Maharashtrian" },
  { slug: "misal-pav", name: "Misal Pav", cuisine: "Maharashtrian" },
  { slug: "poha", name: "Poha", cuisine: "Maharashtrian", aliases: ["pohe"] },
  { slug: "idli-sambar", name: "Idli Sambar", cuisine: "South Indian", aliases: ["idli", "idly"] },
  { slug: "masala-dosa", name: "Masala Dosa", cuisine: "South Indian", aliases: ["dosa"] },
  { slug: "kadhi-chawal", name: "Kadhi Chawal", cuisine: "North Indian" },
  { slug: "jalebi", name: "Jalebi", cuisine: "Dessert" },
  { slug: "gulab-jamun", name: "Gulab Jamun", cuisine: "Dessert" },
  { slug: "rasmalai", name: "Rasmalai", cuisine: "Dessert" },
  { slug: "kulfi", name: "Kulfi", cuisine: "Dessert", aliases: ["kulfi faluda", "falooda"] },
  { slug: "lassi", name: "Lassi", cuisine: "Dessert", aliases: ["sweet lassi"] },
];
