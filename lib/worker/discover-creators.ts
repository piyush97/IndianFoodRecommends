import { and, eq, sql } from "drizzle-orm";
import { schema, type Db } from "../../db";
import { normalizeName, slugify } from "../text";
import type { Upload } from "../youtube";

/**
 * Searches per run, across all cities. yt-dlp search spends no YouTube API
 * quota (ADR-0001), but each search is a YouTube page fetch: keep runs small.
 */
export const MAX_SEARCHES_PER_RUN = 40;
/** Results read per search. */
const RESULTS_PER_SEARCH = 20;
/** Channels per city whose feed and subscriber count are fetched. */
const CHANNELS_PER_CITY = 8;
/** Place names shorter than this match too much ordinary text. */
const MIN_NAME_LENGTH = 5;

export type SearchHit = { channelId: string; channel: string };
export type DiscoverDeps = {
  db: Db;
  search: (query: string, limit: number) => Promise<SearchHit[]>;
  listUploads: (channelId: string) => Promise<Upload[]>;
  subscribers: (channelId: string) => Promise<number | undefined>;
  now: () => Date;
};
export type Evidence = {
  queries: string[];
  mentions: string[];
  newestUpload: string | null;
  subscribers: number | null;
};
export type Candidate = {
  ytChannelId: string;
  name: string;
  citySlug: string;
  score: number;
  evidence: Evidence;
};

/** Known place names (and aliases) that appear as whole words in the uploads' text. */
export function mentionedPlaces(uploads: Upload[], names: Map<string, string>): string[] {
  const text = ` ${uploads.map((u) => normalizeName(`${u.title} ${u.description}`)).join(" ")} `;
  const hits = new Set<string>();
  for (const [key, place] of names) {
    if (key.length >= MIN_NAME_LENGTH && text.includes(` ${key} `)) hits.add(place);
  }
  return [...hits].sort();
}

/**
 * One known-place mention (10) outweighs recency (3 today, 0 at a year) plus
 * subscribers (half log10, so 1M = 3): they only break ties.
 */
export function scoreCandidate(
  mentions: number,
  newest: Date | null,
  subs: number | null,
  now: Date,
) {
  const days = newest ? (now.getTime() - newest.getTime()) / 86_400_000 : Infinity;
  const recency = Math.max(0, 1 - days / 365);
  return Math.round((mentions * 10 + recency * 3 + Math.log10((subs ?? 0) + 1) / 2) * 100) / 100;
}

/** Approved places in a city, keyed by normalised name and alias. */
async function cityPlaceNames(db: Db, cityId: number): Promise<Map<string, string>> {
  const rows = await db.execute<{ key: string; name: string }>(sql`
    select distinct k.key, p.name
    from places p
    join recommendations r on r.place_id = p.id and r.status = 'approved'
    cross join lateral (
      select p.name as key
      union all select a.alias from place_aliases a where a.place_id = p.id
    ) k
    where p.city_id = ${cityId}`);
  return new Map(rows.map((r) => [normalizeName(r.key), r.name]));
}

/** The city's most-picked dishes, for "<dish> in <city>" queries. */
async function topDishes(db: Db, cityId: number, limit: number): Promise<string[]> {
  const rows = await db.execute<{ name: string }>(sql`
    select d.name from recommendations r
    join places p on p.id = r.place_id
    join dishes d on d.id = r.dish_id
    where r.status = 'approved' and p.city_id = ${cityId}
    group by d.name order by count(*) desc limit ${limit}`);
  return rows.map((r) => r.name);
}

/**
 * Finds food channels per city that are not creators yet (opted-out ones
 * included, so they are never re-suggested) and not already decided, scores
 * them, and upserts pending candidates unless `dryRun`.
 */
export async function discoverCreators(
  deps: DiscoverDeps,
  opts: { city?: string; dryRun: boolean },
): Promise<{ searches: number; candidates: Candidate[] }> {
  const { db } = deps;
  const known = new Set(
    [
      ...(await db.select({ id: schema.creators.ytChannelId }).from(schema.creators)),
      ...(await db
        .select({ id: schema.creatorCandidates.ytChannelId })
        .from(schema.creatorCandidates)
        .where(sql`${schema.creatorCandidates.status} <> 'pending'`)),
    ].map((r) => r.id),
  );
  const cities = await db
    .select({ id: schema.cities.id, slug: schema.cities.slug, name: schema.cities.name })
    .from(schema.cities)
    .where(opts.city ? eq(schema.cities.slug, opts.city) : undefined)
    .orderBy(schema.cities.id);

  let searches = 0;
  const candidates: Candidate[] = [];
  for (const city of cities) {
    const queries = [
      `${city.name} street food`,
      `${city.name} food vlog`,
      ...(await topDishes(db, city.id, 2)).map((d) => `${d} in ${city.name}`),
    ];
    const byChannel = new Map<string, { name: string; queries: Set<string>; hits: number }>();
    for (const query of queries) {
      if (searches >= MAX_SEARCHES_PER_RUN) break;
      searches++;
      for (const hit of await deps.search(query, RESULTS_PER_SEARCH)) {
        if (known.has(hit.channelId)) continue;
        const c = byChannel.get(hit.channelId) ?? {
          name: hit.channel,
          queries: new Set(),
          hits: 0,
        };
        c.queries.add(query);
        c.hits++;
        byChannel.set(hit.channelId, c);
      }
    }
    const names = await cityPlaceNames(db, city.id);
    const shortlist = [...byChannel]
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, CHANNELS_PER_CITY);
    for (const [channelId, c] of shortlist) {
      const uploads = await deps.listUploads(channelId).catch(() => []);
      const subs = (await deps.subscribers(channelId).catch(() => undefined)) ?? null;
      const mentions = mentionedPlaces(uploads, names);
      const newest = uploads.reduce<Date | null>(
        (max, u) => (!max || u.publishedAt > max ? u.publishedAt : max),
        null,
      );
      candidates.push({
        ytChannelId: channelId,
        name: c.name,
        citySlug: city.slug,
        score: scoreCandidate(mentions.length, newest, subs, deps.now()),
        evidence: {
          queries: [...c.queries],
          mentions,
          newestUpload: newest?.toISOString().slice(0, 10) ?? null,
          subscribers: subs,
        },
      });
      known.add(channelId);
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!opts.dryRun && candidates.length > 0) {
    await db
      .insert(schema.creatorCandidates)
      .values(candidates)
      .onConflictDoUpdate({
        target: schema.creatorCandidates.ytChannelId,
        set: {
          name: sql`excluded.name`,
          citySlug: sql`excluded.city_slug`,
          score: sql`excluded.score`,
          evidence: sql`excluded.evidence`,
        },
        setWhere: sql`${schema.creatorCandidates.status} = 'pending'`,
      });
  }
  return { searches, candidates };
}

/** Approves a pending candidate: adds it as a creator so the next ingest reads its feed. */
export async function approveCandidate(db: Db, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [c] = await tx
      .update(schema.creatorCandidates)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(
        and(eq(schema.creatorCandidates.id, id), eq(schema.creatorCandidates.status, "pending")),
      )
      .returning();
    if (!c) return;
    const base = slugify(c.name);
    const [taken] = await tx
      .select({ id: schema.creators.id })
      .from(schema.creators)
      .where(eq(schema.creators.slug, base));
    await tx
      .insert(schema.creators)
      .values({ slug: taken ? `${base}-${c.id}` : base, name: c.name, ytChannelId: c.ytChannelId })
      .onConflictDoNothing({ target: schema.creators.ytChannelId });
  });
}

export async function rejectCandidate(db: Db, id: number): Promise<void> {
  await db
    .update(schema.creatorCandidates)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(
      and(eq(schema.creatorCandidates.id, id), eq(schema.creatorCandidates.status, "pending")),
    );
}
