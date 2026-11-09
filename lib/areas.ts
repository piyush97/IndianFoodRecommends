import { sql } from "drizzle-orm";
import { schema, type Db } from "../db";
import { AREA_ALIASES, type AreaAlias } from "../db/area-aliases";
import { normalizeName, slugify } from "./text";

/** One row per (city, locality) group of places, as the sync query returns it. */
export type LocalityRow = {
  city: string;
  locality: string;
  /** Places in the group. */
  n: number;
  /** Places in the group that have a pin. */
  pinned: number;
  lat: number | null;
  lng: number | null;
};

export type AreaDraft = {
  city: string;
  name: string;
  key: string;
  slug: string;
  lat: number;
  lng: number;
  weight: number;
};

/**
 * Comparison key for area names: lowercase, folded, punctuation gone, and runs of single letters
 * joined so "K.K.Nagar", "K K Nagar" and "KK Nagar" are one key.
 */
export function areaKey(s: string): string {
  const out: string[] = [];
  let run = "";
  for (const token of normalizeName(s).split(" ")) {
    if (/^\p{L}$/u.test(token)) {
      run += token;
      continue;
    }
    if (run) out.push(run);
    run = "";
    if (token) out.push(token);
  }
  if (run) out.push(run);
  return out.join(" ");
}

// Words that alone name a kind of place, not a place.
const GENERIC = new Set([
  "nagar",
  "colony",
  "layout",
  "phase",
  "stage",
  "block",
  "road",
  "street",
  "market",
  "mall",
  "station",
  "sector",
  "east",
  "west",
  "north",
  "south",
  "central",
]);
const DIRECTIONS = /^(near|opposite|opp|adjacent|behind|beside|next to)\b/i;

/** "Bandra Reclamation (West)" -> "Bandra Reclamation West"; long notes in brackets are dropped. */
function cleanPart(part: string): string | null {
  const text = part
    .replace(/\(([^)]*)\)/g, (_, inner: string) =>
      inner.trim().split(/\s+/).length <= 2 && !DIRECTIONS.test(inner.trim()) ? ` ${inner}` : "",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!text || DIRECTIONS.test(text)) return null;
  const key = areaKey(text);
  return key.length < 3 || GENERIC.has(key) ? null : text;
}

/**
 * Turns places.locality into areas. "Gokhale Road, Dadar West" names two areas, so every comma
 * part is a candidate; each takes the pin-weighted centre of every group that mentions it.
 * Groups without a pin add weight but no position, and an area with no position is skipped.
 */
export function buildAreas(rows: LocalityRow[]): AreaDraft[] {
  type Acc = {
    spellings: Map<string, number>;
    n: number;
    pinned: number;
    lat: number;
    lng: number;
  };
  const acc = new Map<string, Acc>();
  for (const row of rows) {
    for (const part of row.locality.split(",")) {
      const name = cleanPart(part);
      if (!name) continue;
      const id = `${row.city}\u0000${areaKey(name)}`;
      const a = acc.get(id) ?? { spellings: new Map(), n: 0, pinned: 0, lat: 0, lng: 0 };
      a.spellings.set(name, (a.spellings.get(name) ?? 0) + row.n);
      a.n += row.n;
      if (row.pinned > 0 && row.lat != null && row.lng != null) {
        a.pinned += row.pinned;
        a.lat += row.lat * row.pinned;
        a.lng += row.lng * row.pinned;
      }
      acc.set(id, a);
    }
  }
  const drafts: AreaDraft[] = [];
  for (const [id, a] of acc) {
    if (a.pinned === 0) continue;
    // Most used spelling wins; ties go to the alphabetically first so reruns are stable.
    const [name] = [...a.spellings].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0];
    drafts.push({
      city: id.split("\u0000")[0],
      name,
      key: areaKey(name),
      slug: slugify(name),
      lat: a.lat / a.pinned,
      lng: a.lng / a.pinned,
      weight: a.n,
    });
  }
  return drafts.sort((x, y) => x.city.localeCompare(y.city) || x.slug.localeCompare(y.slug));
}

/** Other names people type for a city, besides its registry name. */
const CITY_SYNONYMS: Record<string, string[]> = {
  mumbai: ["bombay"],
  kolkata: ["calcutta"],
  chennai: ["madras"],
  bengaluru: ["bangalore"],
};

/**
 * Drops the city name from either end of a query ("fort mumbai" -> "fort") for matching. A query
 * that is only the city name, or whose rest would be empty, is returned unchanged.
 */
export function withoutCity(rawQuery: string, slug: string, cityName: string): string {
  const words = new Set([areaKey(cityName), ...(CITY_SYNONYMS[slug] ?? [])]);
  const tokens = areaKey(rawQuery).split(" ");
  while (tokens.length > 1 && words.has(tokens[tokens.length - 1])) tokens.pop();
  while (tokens.length > 1 && words.has(tokens[0])) tokens.shift();
  return tokens.join(" ");
}

/** Reads locality groups from the places table. */
export async function readLocalities(db: Db): Promise<LocalityRow[]> {
  const rows = await db.execute<{
    city: string;
    locality: string;
    n: number;
    pinned: number;
    lat: number | null;
    lng: number | null;
  }>(sql`
    select c.slug as city, p.locality, count(*)::int as n, count(p.lat)::int as pinned,
           avg(p.lat)::float8 as lat, avg(p.lng)::float8 as lng
    from places p join cities c on c.id = p.city_id
    where p.locality is not null and p.locality <> ''
    group by c.slug, p.locality`);
  return [...rows];
}

export type SyncResult = { areas: number; aliases: number; unmatchedAliases: string[] };

/**
 * Upserts areas derived from `rows` and the curated aliases. Idempotent: reruns refresh centres
 * and weights of `places` areas and never touch manual, osm or nominatim rows' positions.
 */
export async function syncAreas(
  db: Db,
  rows: LocalityRow[],
  aliases: AreaAlias[] = AREA_ALIASES,
): Promise<SyncResult> {
  const drafts = buildAreas(rows);
  const cities = await db
    .select({ id: schema.cities.id, slug: schema.cities.slug })
    .from(schema.cities);
  const cityId = new Map(cities.map((c) => [c.slug, c.id]));
  const values = drafts.flatMap((d) => {
    const id = cityId.get(d.city);
    return id === undefined
      ? []
      : [
          {
            cityId: id,
            name: d.name,
            key: d.key,
            slug: d.slug,
            lat: d.lat,
            lng: d.lng,
            weight: d.weight,
          },
        ];
  });
  for (let i = 0; i < values.length; i += 200) {
    await db
      .insert(schema.areas)
      .values(values.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [schema.areas.cityId, schema.areas.slug],
        set: {
          name: sql`excluded.name`,
          key: sql`excluded.key`,
          lat: sql`case when ${schema.areas.source} = 'places' then excluded.lat else ${schema.areas.lat} end`,
          lng: sql`case when ${schema.areas.source} = 'places' then excluded.lng else ${schema.areas.lng} end`,
          weight: sql`excluded.weight`,
        },
      });
  }

  const unmatched: string[] = [];
  let aliasCount = 0;
  for (const entry of aliases) {
    const id = cityId.get(entry.city);
    const [area] = id
      ? await db
          .select({ id: schema.areas.id })
          .from(schema.areas)
          .where(
            sql`${schema.areas.cityId} = ${id} and ${schema.areas.key} = ${areaKey(entry.area)}`,
          )
      : [];
    if (!area) {
      unmatched.push(`${entry.city}/${entry.area}`);
      continue;
    }
    const inserted = await db
      .insert(schema.areaAliases)
      .values(entry.aliases.map((alias) => ({ areaId: area.id, alias, key: areaKey(alias) })))
      .onConflictDoNothing()
      .returning({ id: schema.areaAliases.id });
    aliasCount += inserted.length;
  }
  return { areas: values.length, aliases: aliasCount, unmatchedAliases: unmatched };
}

export type AreaHit = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  /** 1 for an exact name or alias, else the best trigram score. */
  score: number;
  source: "places" | "manual" | "osm" | "nominatim";
};

/** At or above this a local match is trusted; below it we ask OpenStreetMap or offer choices. */
export const ACCEPT = 0.55;
/** Below this a name is too far off to even suggest. */
export const SUGGEST = 0.3;
/** Area names this short or shorter are matched exactly only: trigrams of "cp" mean nothing. */
const MIN_FUZZY = 3;
/** A name inside a longer query ("karol bagh market") counts only for names at least this long. */
const MIN_CONTAINED = 5;

/** Optimal string alignment distance: insert, delete, substitute, swap neighbours. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Sound-alike form for Indian place names written in English: "kapoor" and "kapur", "alipore" and
 * "alipur", "shahdra" and "shahdara", "kolaba" and "colaba" all share one skeleton. Vowels after a
 * word's first letter, h and y are dropped and similar consonants are folded.
 */
export function skeleton(key: string): string {
  return key
    .split(" ")
    .map((word) => {
      const folded = word
        .replace(/ph/g, "f")
        .replace(/[ckq]/g, "k")
        .replace(/w/g, "v")
        .replace(/z/g, "j")
        .replace(/[hy]/g, "")
        .replace(/(.)\1+/g, "$1");
      return folded.charAt(0) + folded.slice(1).replace(/[aeiou]/g, "");
    })
    .join(" ")
    .replace(/^[aeiou]/, "a");
}

/**
 * Score of one stored key against the query, 0 to 1. Trigram similarity finds candidates; the rest
 * is precision: a whole-word containment ("hazratganj metro"), a bounded edit distance (a swapped
 * or missing letter) and a matching skeleton (a different vowel). Each can only raise the score,
 * and each is bounded so "besant nagar" does not become "Anna Nagar".
 */
export function scoreKey(key: string, q: string, trigram: number): number {
  if (key === q) return 1;
  let score = trigram;
  const words = q.split(" ");
  if (key.length >= MIN_CONTAINED && key.split(" ").every((w) => words.includes(w))) score = 0.9;
  const longest = Math.max(key.length, q.length);
  const allowed = longest < 5 ? 0 : longest < 8 ? 1 : longest < 12 ? 2 : 3;
  const edits = editDistance(key, q);
  if (edits <= allowed) score = Math.max(score, 0.95 - 0.05 * edits);
  const sound = skeleton(key);
  if (sound.replace(/ /g, "").length >= 3 && sound === skeleton(q)) score = Math.max(score, 0.8);
  return score;
}

/**
 * Areas in one city ranked against `rawQuery`. The database narrows to plausible names with the
 * trigram index; `scoreKey` then ranks them. Exact first, then score, then the more specific
 * (longer) name, then the area more places mention.
 */
export async function matchAreas(db: Db, cityId: number, rawQuery: string): Promise<AreaHit[]> {
  const q = areaKey(rawQuery);
  if (!q) return [];
  const fuzzy = q.length >= MIN_FUZZY;
  const rows = await db.execute<{
    id: number;
    name: string;
    lat: number;
    lng: number;
    weight: number;
    source: AreaHit["source"];
    key: string;
    sim: number;
  }>(sql`
    select a.id, a.name, a.lat, a.lng, a.weight, a.source::text as source, a.key,
           similarity(a.key, ${q})::float8 as sim
    from areas a
    where a.city_id = ${cityId}
      and (a.key = ${q} or (${fuzzy} and (a.key % ${q} or a.key <% ${q})))
    union all
    select a.id, a.name, a.lat, a.lng, a.weight, a.source::text, l.key,
           similarity(l.key, ${q})::float8
    from area_aliases l join areas a on a.id = l.area_id
    where a.city_id = ${cityId}
      and (l.key = ${q} or (${fuzzy} and (l.key % ${q} or l.key <% ${q})))`);
  const best = new Map<number, AreaHit & { specificity: number; weight: number }>();
  for (const r of rows) {
    const score = scoreKey(r.key, q, Number(r.sim));
    const prev = best.get(r.id);
    if (prev && prev.score >= score) continue;
    best.set(r.id, {
      id: r.id,
      name: r.name,
      lat: Number(r.lat),
      lng: Number(r.lng),
      score,
      source: r.source,
      specificity: r.key.length,
      weight: Number(r.weight),
    });
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || b.specificity - a.specificity || b.weight - a.weight)
    .map(({ id, name, lat, lng, score, source }) => ({ id, name, lat, lng, score, source }));
}

/** Choices for "Did you mean": plausible, not an upstream cache entry, not stacked on each other. */
export function suggestionsFrom(hits: AreaHit[], limit = 3): AreaHit[] {
  const out: AreaHit[] = [];
  for (const h of hits) {
    if (h.score < SUGGEST || h.source === "nominatim") continue;
    if (out.some((o) => Math.abs(o.lat - h.lat) < 0.005 && Math.abs(o.lng - h.lng) < 0.005))
      continue;
    out.push(h);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * Keeps an upstream hit so the next person who types the same thing never leaves our database.
 * A hit within 500 m of a known area becomes an alias of it; anything else becomes a
 * `nominatim` area named by OpenStreetMap, which is never offered as a suggestion.
 */
export async function rememberUpstream(
  db: Db,
  cityId: number,
  typed: string,
  hit: { lat: number; lng: number; displayName: string },
): Promise<void> {
  const typedKey = areaKey(typed);
  if (!typedKey) return;
  const [near] = await db
    .select({ id: schema.areas.id })
    .from(schema.areas)
    .where(
      sql`${schema.areas.cityId} = ${cityId}
        and abs(${schema.areas.lat} - ${hit.lat}) < 0.0045
        and abs(${schema.areas.lng} - ${hit.lng}) < 0.0045`,
    )
    .orderBy(sql`abs(${schema.areas.lat} - ${hit.lat}) + abs(${schema.areas.lng} - ${hit.lng})`)
    .limit(1);
  let areaId = near?.id;
  if (areaId === undefined) {
    const name = cleanPart(hit.displayName.split(",")[0] ?? "") ?? null;
    if (!name) return;
    const [row] = await db
      .insert(schema.areas)
      .values({
        cityId,
        name,
        key: areaKey(name),
        slug: slugify(name),
        lat: hit.lat,
        lng: hit.lng,
        weight: 0,
        source: "nominatim",
      })
      .onConflictDoUpdate({
        target: [schema.areas.cityId, schema.areas.slug],
        set: { weight: sql`${schema.areas.weight}` },
      })
      .returning({ id: schema.areas.id });
    areaId = row.id;
  }
  await db
    .insert(schema.areaAliases)
    .values({ areaId, alias: typed.trim(), key: typedKey })
    .onConflictDoNothing();
}
