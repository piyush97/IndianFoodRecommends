// Seed content for Sprint 0. Kept separate from db/seed.ts so it can be tested
// without a database. Slugs are the public URL keys: keep them stable.
export type SeedDish = {
  slug: string;
  name: string;
  cuisine: string;
  aliases?: string[];
};

import { CITIES } from "../lib/cities";

export const cities = CITIES.map(({ slug, name, state }) => ({ slug, name, state }));

export const creators = [
  {
    slug: "ayush-sapra",
    name: "Aayush Sapra",
    ytChannelId: "UC2UWtuZR3kH-5C26HVMMB6A",
    igHandle: "aayushsapra2",
  },
  // Channel IDs resolved from each @handle page and checked against the live feed.
  {
    slug: "delhi-food-walks",
    name: "Delhi Food Walks",
    ytChannelId: "UC2LxkEsKAr_Qrm_IKESnOnQ",
    igHandle: null,
  },
  {
    slug: "sadi-gaddi",
    name: "Sadi Gaddi",
    ytChannelId: "UCPEaAv-_U49k7j_X0wfkNQA",
    igHandle: null,
  },
  {
    slug: "bhooka-saand",
    name: "Bhooka Saand",
    ytChannelId: "UCv6Vt0cc-CNQrRj4yCBG9Ig",
    igHandle: null,
  },
  {
    slug: "veggie-paaji",
    name: "Veggie Paaji",
    ytChannelId: "UCVC9JRU1JpfupKHVV0sThOg",
    igHandle: null,
  },
  {
    slug: "foodie-incarnate",
    name: "Foodie Incarnate",
    ytChannelId: "UCMfyiLGzptAStxYf7GEIQYQ",
    igHandle: null,
  },
  {
    slug: "dilsefoodie",
    name: "Dilsefoodie Official",
    ytChannelId: "UCxiBEi8RF-l6ib4SMDTd35w",
    igHandle: null,
  },
  {
    slug: "the-urban-guide",
    name: "The Urban Guide",
    ytChannelId: "UCycORvCTjr7zn-fxttE81zw",
    igHandle: null,
  }, // Mumbai (S4-2): recent uploads are mostly Mumbai/Thane food reviews.
  {
    slug: "anagha-mirgal",
    name: "Anagha Mirgal",
    ytChannelId: "UCgLkCMpT3u-h9XWWzkOofvA",
    igHandle: null,
  },
  {
    slug: "dil-dosti-food",
    name: "Dil Dosti Food",
    ytChannelId: "UC6r_Xa5FPbCPEJYXnVj5D5g",
    igHandle: null,
  },
  {
    slug: "the-mumbai-foodie",
    name: "The Mumbai Foodie",
    ytChannelId: "UCe4HdRHk3TDQ9c8RzJyxs0g",
    igHandle: null,
  },
  // Kolkata (S4-2).
  {
    slug: "the-lazy-bong",
    name: "The Lazy Bong",
    ytChannelId: "UCTjYxU04HjYDb5oPmGWmKCw",
    igHandle: null,
  },
  { slug: "foodka", name: "Foodka", ytChannelId: "UCByoEPQbSxyB7PGFDmqtHwQ", igHandle: null },
  // Added Nov 2026: multi-city creators found by search; Mumbai/Kolkata were thin.
  {
    slug: "khaane-mein-kya-hai",
    name: "Khaane Mein Kya Hai",
    ytChannelId: "UCvTLyB-aixsl4MhiMEomVRQ",
    igHandle: null,
  },
  {
    slug: "harry-uppal",
    name: "Harry Uppal",
    ytChannelId: "UC4qXyMvDs6OnNEnjQtinZJA",
    igHandle: null,
  },
  { slug: "spiceler", name: "Spiceler", ytChannelId: "UCliImq_HTFRvNwS3C5GAVnA", igHandle: null },
  {
    slug: "lets-eat-folks",
    name: "LeT'S Eat Folks",
    ytChannelId: "UCJHhhU4DssItHxd54deYUwQ",
    igHandle: null,
  },
  {
    slug: "mr-singh-food-hunter",
    name: "Mr. Singh Food Hunter",
    ytChannelId: "UCM-q0U0F6-oMOFTYPtlsEfA",
    igHandle: null,
  },
  // Nov 2026: Hyderabad, Bengaluru, Chennai, Lucknow, Jaipur. IDs checked against live channel pages.
  {
    slug: "srikanth-food-travel",
    name: "Srikanth Food & Travel",
    ytChannelId: "UCB3ulkE6fBsUd4z36eUpheQ",
    igHandle: null,
  },
  {
    slug: "luv4-food-n-travel",
    name: "Luv4FoodNTravel",
    ytChannelId: "UC6wyBRRPT5P-kZ1RV-h3WQA",
    igHandle: null,
  },
  {
    slug: "pramod-bathija",
    name: "Pramod Bathija",
    ytChannelId: "UCKsqD8PX3AZpvIrtueaVvQg",
    igHandle: null,
  },
  {
    slug: "street-byte",
    name: "Street Byte",
    ytChannelId: "UCqA2ZPcBYbWqmKU3iFX2KwA",
    igHandle: null,
  },
  {
    slug: "food-lovers-tv",
    name: "Food Lovers TV",
    ytChannelId: "UC-Lq6oBPTgTXT_K-ylWL6hg",
    igHandle: null,
  },
  {
    slug: "unbox-karnataka",
    name: "Unbox Karnataka",
    ytChannelId: "UCst7dIH10mMvu_PVpXMr7Hw",
    igHandle: null,
  },
  {
    slug: "rocking-rasheed",
    name: "Rocking Rasheed",
    ytChannelId: "UCk5vtg6Kxgd1s20a6_PHZSQ",
    igHandle: null,
  },
  {
    slug: "the-chennai-foodie",
    name: "The Chennai Foodie",
    ytChannelId: "UC0_SrJRdNGxPdXMRFOonU9Q",
    igHandle: null,
  },
  {
    slug: "foodie-prabu",
    name: "Foodie Prabu",
    ytChannelId: "UCB2XQ5q22gU0AWwdN24g15Q",
    igHandle: null,
  },
  {
    slug: "peppa-foodie",
    name: "Peppa Foodie",
    ytChannelId: "UC8wwXAm77RNzVN-cJOy8t8g",
    igHandle: null,
  },
  {
    slug: "pakoda-boyz",
    name: "Pakoda Boyz",
    ytChannelId: "UClz0pLkTqii1UhWHUIxBTOA",
    igHandle: null,
  },
  { slug: "ama-miyan", name: "Ama Miyan", ytChannelId: "UCNU4Kdw5GouCaU340JctOTw", igHandle: null },
  {
    slug: "safarkhana",
    name: "Safarkhana",
    ytChannelId: "UCwBGnFUkyqGkv2b7K1cx3_A",
    igHandle: null,
  },
  {
    slug: "jaipur-food-tales",
    name: "Jaipur Food Tales",
    ytChannelId: "UCBEY_Z44umpRZEutIUEEVAw",
    igHandle: null,
  },
  {
    slug: "jaipur-food-xplorer",
    name: "Jaipur Food Xplorer",
    ytChannelId: "UCAqv9pvn1Fkd_gCRu3-ZASg",
    igHandle: null,
  },
  // Kolkata and Mumbai coverage (#39).
  { slug: "foodzpah", name: "FoodZpah", ytChannelId: "UCKieyGPRpMvIMn1b0rbKrqg", igHandle: null },
  {
    slug: "golgappa-girl",
    name: "Golgappa Girl",
    ytChannelId: "UCnwL537dF3kV8hGVHvvof3Q",
    igHandle: null,
  },
  {
    slug: "food-venture-folks",
    name: "Food Venture Folks",
    ytChannelId: "UCmpl1CVoCCiNlVk4WKY65Vw",
    igHandle: null,
  },
];

export const dishes: SeedDish[] = [
  {
    slug: "chole-bhature",
    name: "Chole Bhature",
    cuisine: "Punjabi",
    aliases: ["chhole bhature", "chana bhatura"],
  },
  {
    slug: "butter-chicken",
    name: "Butter Chicken",
    cuisine: "Punjabi",
    aliases: ["murgh makhani"],
  },
  { slug: "rajma-chawal", name: "Rajma Chawal", cuisine: "Punjabi" },
  {
    slug: "paranthas",
    name: "Paranthas",
    cuisine: "North Indian",
    aliases: ["parathas", "paranthe"],
  },
  { slug: "nihari", name: "Nihari", cuisine: "Mughlai" },
  { slug: "seekh-kebab", name: "Seekh Kebab", cuisine: "Mughlai", aliases: ["kebabs"] },
  { slug: "biryani", name: "Biryani", cuisine: "Hyderabadi" },
  {
    slug: "gol-gappe",
    name: "Gol Gappe",
    cuisine: "Street Food",
    aliases: ["pani puri", "puchka", "gol gappa"],
  },
  { slug: "aloo-chaat", name: "Aloo Chaat", cuisine: "Street Food", aliases: ["chaat"] },
  { slug: "dahi-bhalla", name: "Dahi Bhalla", cuisine: "Street Food", aliases: ["dahi vada"] },
  { slug: "aloo-tikki", name: "Aloo Tikki", cuisine: "Street Food" },
  { slug: "samosa", name: "Samosa", cuisine: "Street Food" },
  { slug: "kachori", name: "Kachori", cuisine: "Street Food", aliases: ["kofte wali kachori"] },
  { slug: "daulat-ki-chaat", name: "Daulat ki Chaat", cuisine: "Street Food" },
  {
    slug: "kathi-roll",
    name: "Kathi Roll",
    cuisine: "Street Food",
    aliases: ["rolls", "egg roll"],
  },
  { slug: "momos", name: "Momos", cuisine: "Indo-Chinese", aliases: ["momo"] },
  { slug: "chilli-chicken", name: "Chilli Chicken", cuisine: "Indo-Chinese" },
  {
    slug: "hakka-noodles",
    name: "Hakka Noodles",
    cuisine: "Indo-Chinese",
    aliases: ["chowmein", "chow mein"],
  },
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
