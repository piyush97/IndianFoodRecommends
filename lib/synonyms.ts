import { normalizeName } from "./text";

// Alternate spellings, Hindi/Devanagari and regional names of one dish. Every term is already
// normalizeName()d (the tests enforce it) and appears in one group only. Group dishes that are the
// same thing; "chicken biryani" and "mutton biryani" stay out of the "biryani" group because they
// reach it through whole-word containment in expandQuery.
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  [
    "pani puri",
    "gol gappe",
    "golgappa",
    "golgappe",
    "panipuri",
    "puchka",
    "phuchka",
    "पानी पूरी",
    "गोलगप्पे",
  ],
  ["chole bhature", "chhole bhature", "chole bhatoore", "छोले भटूरे"],
  ["biryani", "biriyani", "briyani", "biriani", "बिरयानी", "बिरियानी"],
  ["momos", "momo", "मोमोज", "मोमो"],
  ["vada pav", "wada pav", "vadapav", "vada pao", "वड़ा पाव", "वडा पाव"],
  ["nihari", "nahari", "निहारी"],
  ["kathi roll", "kati roll", "काठी रोल"],
  ["haleem", "halim", "हलीम"],
  ["seekh kebab", "seekh kabab", "seekh kabob", "sheekh kabab", "सीख कबाब"],
  ["coffee", "kaapi", "कॉफी"],
  ["fish fry", "machli fry", "machhli fry", "मछली फ्राई"],
  ["pizza", "पिज़्ज़ा", "पिज्जा"],
  ["butter chicken", "murgh makhani", "बटर चिकन", "मुर्ग मखनी"],
  ["idli", "idly", "इडली"],
  ["sambar", "sambhar", "sambaar", "सांबर", "सांभर"],
  ["dosa", "dosai", "डोसा"],
  ["masala dosa", "masala dosai", "मसाला डोसा"],
  ["aloo tikki", "alu tikki", "आलू टिक्की"],
  ["aloo chaat", "alu chaat", "आलू चाट"],
  ["pav bhaji", "paav bhaji", "pao bhaji", "पाव भाजी"],
  ["chicken curry", "चिकन करी"],
  ["tandoori chicken", "tandoori murgh", "तंदूरी चिकन", "तन्दूरी चिकन"],
  ["mandi", "mandhi"],
  ["paratha", "parantha", "पराठा", "परांठा"],
  ["chilli chicken", "chili chicken", "chilly chicken", "चिली चिकन", "चिल्ली चिकन"],
  ["kachori", "kachauri", "कचौरी"],
  ["laddu", "ladoo", "laddoo", "ladu", "लड्डू", "लड्डु"],
  ["samosa", "समोसा"],
  ["paneer tikka", "पनीर टिक्का"],
  ["korma", "qorma", "kurma", "कोरमा"],
  ["misal", "मिसळ", "मिसल"],
  ["khima", "keema", "kheema", "qeema", "खीमा", "कीमा"],
  ["juice", "जूस"],
  ["bhel puri", "bhelpuri", "भेल पूरी"],
  ["sev puri", "sevpuri", "सेव पूरी"],
  ["dahi puri", "दही पूरी"],
  ["papdi chaat", "papri chaat", "पापड़ी चाट"],
  ["dahi bhalla", "dahi bhalle", "dahi vada", "दही भल्ले", "दही वड़ा"],
  ["dabeli", "दाबेली"],
  ["jalebi", "jilebi", "जलेबी"],
  ["kulfi", "कुल्फी"],
  ["lassi", "लस्सी"],
  ["chai", "चाय"],
  ["rasgulla", "rasagulla", "rosogolla", "रसगुल्ला"],
  ["gulab jamun", "gulabjamun", "गुलाब जामुन"],
  ["dhokla", "ढोकला"],
  ["poha", "पोहा"],
  ["thali", "थाली"],
  ["rajma chawal", "राजमा चावल"],
  ["dal makhani", "dal makhni", "दाल मखनी"],
  ["kulcha", "kulche", "कुलचा", "कुल्चा"],
  ["litti chokha", "litti choka", "लिट्टी चोखा"],
  ["pakora", "pakoda", "pakode", "पकौड़ा", "पकोड़ा", "पकौड़े"],
  ["kheer", "खीर"],
];

const MAX_TERMS = 12;

/** The normalized query first, then every synonym of each group it names; [] for a blank query. */
export function expandQuery(q: string): string[] {
  const n = normalizeName(q);
  if (!n) return [];
  const padded = ` ${n} `;
  const out = new Set([n]);
  for (const group of SYNONYM_GROUPS) {
    if (group.some((t) => padded.includes(` ${t} `))) for (const t of group) out.add(t);
  }
  return [...out].slice(0, MAX_TERMS);
}
