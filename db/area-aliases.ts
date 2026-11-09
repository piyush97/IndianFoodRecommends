/**
 * Hand-curated nicknames, short forms and Devanagari spellings for areas we already know.
 * `area` must match an existing area's name (after normalising); an entry that matches nothing
 * is reported by `pnpm worker areas` so a typo here cannot pass silently.
 * Plain misspellings are not listed: trigram matching in lib/areas.ts handles those.
 */
export type AreaAlias = { city: string; area: string; aliases: string[] };

export const AREA_ALIASES: AreaAlias[] = [
  // Delhi
  {
    city: "delhi",
    area: "Connaught Place",
    aliases: ["CP", "Connaught Circus", "Rajiv Chowk", "कनॉट प्लेस"],
  },
  { city: "delhi", area: "Chandni Chowk", aliases: ["Chandi Chowk", "चांदनी चौक"] },
  { city: "delhi", area: "Karol Bagh", aliases: ["करोल बाग"] },
  {
    city: "delhi",
    area: "Greater Kailash",
    aliases: ["GK", "GK1", "GK 1", "Greater Kailash 1", "Greater Kailash I"],
  },
  { city: "delhi", area: "GK-2", aliases: ["GK2", "Greater Kailash 2", "Greater Kailash II"] },
  { city: "delhi", area: "Jama Masjid", aliases: ["जामा मस्जिद"] },
  { city: "delhi", area: "Majnu ka Tilla", aliases: ["MKT", "Majnu Tila", "Majnu Ka Tila"] },
  { city: "delhi", area: "South Extension", aliases: ["South Ex", "South Ex 1"] },
  { city: "delhi", area: "Daryaganj", aliases: ["Dariyaganj", "Darya Ganj"] },
  // Mumbai
  { city: "mumbai", area: "BKC", aliases: ["Bandra Kurla Complex", "Bandra Kurla"] },
  {
    city: "mumbai",
    area: "CSMT",
    aliases: ["CST", "VT", "Victoria Terminus", "Chhatrapati Shivaji Terminus"],
  },
  { city: "mumbai", area: "Colaba", aliases: ["Colaba Causeway"] },
  { city: "mumbai", area: "Vile Parle", aliases: ["Parle", "Vile Parle East"] },
  { city: "mumbai", area: "Lalbaug", aliases: ["Lalbagh", "Lal Baug"] },
  { city: "mumbai", area: "Sion Koliwada", aliases: ["Sion", "Koliwada"] },
  { city: "mumbai", area: "Bhendi Bazar", aliases: ["Bhendi Bazaar"] },
  // Bengaluru
  { city: "bengaluru", area: "JP Nagar", aliases: ["J P Nagar", "Jayaprakash Nagar"] },
  { city: "bengaluru", area: "BTM Layout", aliases: ["BTM"] },
  { city: "bengaluru", area: "HSR Layout", aliases: ["HSR"] },
  { city: "bengaluru", area: "Indiranagar", aliases: ["Indira Nagar"] },
  { city: "bengaluru", area: "M G Road", aliases: ["MG Road", "Mahatma Gandhi Road"] },
  { city: "bengaluru", area: "Jayanagar", aliases: ["Jaya Nagar"] },
  { city: "bengaluru", area: "Halasuru", aliases: ["Ulsoor"] },
  { city: "bengaluru", area: "VV Puram", aliases: ["Visveswarapuram"] },
  { city: "bengaluru", area: "Krishnarajapuram", aliases: ["KR Puram"] },
  { city: "bengaluru", area: "CBD", aliases: ["Central Business District"] },
  // Hyderabad
  { city: "hyderabad", area: "HITEC City", aliases: ["Hi-Tech City"] },
  { city: "hyderabad", area: "Kukatpally", aliases: ["KPHB"] },
  // Chennai
  { city: "chennai", area: "T. Nagar", aliases: ["T Nagar", "TNagar", "Thyagaraya Nagar"] },
  { city: "chennai", area: "K.K.Nagar", aliases: ["KK Nagar"] },
  { city: "chennai", area: "Mount Road", aliases: ["Anna Salai"] },
  // Lucknow
  { city: "lucknow", area: "Hazratganj", aliases: ["Hazrat Ganj"] },
  { city: "lucknow", area: "Husainabad", aliases: ["Hussainabad"] },
  { city: "lucknow", area: "Gomti Nagar", aliases: ["Gomtinagar"] },
  { city: "lucknow", area: "Alambagh", aliases: ["Alam Bagh"] },
  // Kolkata
  {
    city: "kolkata",
    area: "Salt Lake Sector V",
    aliases: ["Salt Lake Sector 5", "Sector V", "Sector 5"],
  },
  // Jaipur
  { city: "jaipur", area: "Chandpole Bazar", aliases: ["Chandpole"] },
];
