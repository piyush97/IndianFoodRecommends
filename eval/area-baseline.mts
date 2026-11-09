// The "before" number: the old behaviour (ask OpenStreetMap for `${typed}, ${city}`, drop answers
// over 100 km from the city) on the same 164 queries. Calls Nominatim at 1 request/second, so a run
// takes about 3 minutes. Run: pnpm tsx eval/area-baseline.mts
import { CITIES } from "../lib/cities";
import { buildAreas } from "../lib/areas";
import { haversineKm } from "../components/near-me";
import { suggestLocation } from "../lib/review";
import { loadLocalities, loadQueries, summarise, type Outcome } from "./area-eval";

const areas = buildAreas(loadLocalities());
const centre = (city: string) => {
  const own = areas.filter((a) => a.city === city);
  return {
    lat: own.reduce((s, a) => s + a.lat, 0) / own.length,
    lng: own.reduce((s, a) => s + a.lng, 0) / own.length,
  };
};

const outcomes: Outcome[] = [];
for (const query of loadQueries()) {
  const cityName = CITIES.find((c) => c.slug === query.city)!.name;
  const hit = await suggestLocation(`${query.q}, ${cityName}`).catch(() => null);
  const inCity = hit && haversineKm(centre(query.city), hit) <= 100;
  const want = areas.find((a) => a.city === query.city && a.name === query.expect);
  // A resolvable query passes when the answer lands within 3 km of the area; a negative passes
  // when nothing in the city came back.
  const pass = query.expect === null ? !inCity : !!inCity && !!want && haversineKm(want, hit!) <= 3;
  outcomes.push({ query, got: inCity ? `${hit!.lat},${hit!.lng}` : null, pass });
}
const s = summarise(outcomes);
console.log(
  JSON.stringify({
    resolvable: `${s.resolvable.passed}/${s.resolvable.total}`,
    negativesRefused: `${s.rejected.passed}/${s.rejected.total}`,
    byKind: s.byKind,
  }),
);
