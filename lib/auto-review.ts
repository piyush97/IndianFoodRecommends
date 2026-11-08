import { and, eq, inArray, sql } from "drizzle-orm";
import { schema, type Db } from "../db";
import { CITIES, cityBySlug, cityFromName, type City } from "./cities";
import type { ExtractedPick } from "./llm/extract";
import type { Match } from "./matcher";
import { insertWithSlug, suggestLocation } from "./review";
import { canonicalDishName, normalizeName, slugify } from "./text";
import type { Upload } from "./youtube";

/**
 * Replaces the human queue: Jev checks each LLM pick against the video text,
 * code applies fixed thresholds, and the pick is approved or rejected in the
 * same run. Every decision and its reason is stored in `extracted.autoReview`.
 */

export type PickCheck = {
  grounded: number; // video text names this place
  dishGrounded: number; // video text mentions the dish
  isVenue: number; // place_name is a shop/restaurant, not a dish or a person
  recommends: number; // video speaks well of it
  /** Jev's pick among registered city slugs or "other", used only when the LLM gave no city. */
  city: string;
  cityConfidence: number;
};

export type Decision =
  | { approve: true; city: string }
  | {
      approve: false;
      reason:
        | "not-supported-city"
        | "city-unknown"
        | "not-grounded"
        | "not-a-venue"
        | "not-recommended"
        | "low-confidence"
        | "city-mismatch"
        | "dish-not-grounded"
        | "duplicate";
    };

const MIN_LLM_CONFIDENCE = 0.5;
const MIN_GROUNDED = 0.7;
const MIN_VENUE = 0.6;
const MIN_RECOMMENDS = 0.6;
const MIN_CITY_WHEN_UNSTATED = 0.8;
const REUSE_MATCH_SCORE = 0.8;

type Reviewable = ExtractedPick & { submitted?: boolean };

export function decidePick(pick: Reviewable, check: PickCheck): Decision {
  let city: City | null;
  if (pick.submitted) {
    // Visitor-typed city: only the video decides, so Jev must name the same city.
    city = cityFromName(pick.city);
    if (!city || check.city !== city.slug || check.cityConfidence < MIN_CITY_WHEN_UNSTATED) {
      return { approve: false, reason: "city-mismatch" };
    }
  } else if (pick.city) {
    city = cityFromName(pick.city);
    if (!city) return { approve: false, reason: "not-supported-city" };
  } else {
    city = check.cityConfidence >= MIN_CITY_WHEN_UNSTATED ? cityBySlug(check.city) : null;
    if (!city) return { approve: false, reason: "city-unknown" };
  }
  if (pick.confidence < MIN_LLM_CONFIDENCE) return { approve: false, reason: "low-confidence" };
  if (check.grounded < MIN_GROUNDED) return { approve: false, reason: "not-grounded" };
  // Visitor-typed dish becomes a public page: it must appear in the video text.
  if (pick.submitted && check.dishGrounded < MIN_GROUNDED) {
    return { approve: false, reason: "dish-not-grounded" };
  }
  if (check.isVenue < MIN_VENUE) return { approve: false, reason: "not-a-venue" };
  if (check.recommends < MIN_RECOMMENDS) return { approve: false, reason: "not-recommended" };
  return { approve: true, city: city.slug };
}

export async function checkPick(
  video: { title: string; description: string },
  pick: ExtractedPick,
  opts: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<PickCheck> {
  const res = await (opts.fetchImpl ?? fetch)("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "jev-latest",
      state: {
        title: video.title,
        description: video.description.slice(0, 6000),
        place_name: pick.place_name,
        dishes: pick.dishes,
      },
      questions: {
        grounded: {
          type: "noul",
          instructions: "The `title` or `description` names the food place `place_name`",
        },
        dish_grounded: {
          type: "noul",
          instructions: "The `title` or `description` mentions the dish in `dishes`",
        },
        is_venue: {
          type: "noul",
          instructions:
            "`place_name` is the name of a restaurant, shop, or stall, not a dish name or a person",
        },
        recommends: {
          type: "noul",
          instructions:
            "The video presents `place_name` positively, as a place worth visiting for `dishes`",
        },
        city: {
          type: "choice",
          instructions:
            "Which city `place_name` is located in, judging only from `title` and `description`",
          criteria: {
            ...Object.fromEntries(CITIES.map((c) => [c.slug, [c.name, ...c.aliases].join(", ")])),
            other: "Any other city, or it cannot be told",
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Jev request failed with status ${res.status}`);
  const { answers } = (await res.json()) as {
    answers: Record<"grounded" | "dish_grounded" | "is_venue" | "recommends", { noul: number }> & {
      city: { choice: string; confidence: number };
    };
  };
  return {
    grounded: answers.grounded.noul,
    dishGrounded: answers.dish_grounded.noul,
    isVenue: answers.is_venue.noul,
    recommends: answers.recommends.noul,
    city: answers.city.choice,
    cityConfidence: answers.city.confidence,
  };
}

type Suggestions = { places?: Match[]; dishes?: Match[] };

export type AutoReviewDeps = {
  db: Db;
  listUploads: (channelId: string) => Promise<Upload[]>;
  /** Deeper lookup, tried once per channel when a pending pick's video is outside the feed window. */
  listArchive?: (channelId: string) => Promise<Upload[]>;
  check: (video: { title: string; description: string }, pick: ExtractedPick) => Promise<PickCheck>;
  geocode?: (query: string) => Promise<{ lat: number; lng: number; osmId: string } | null>;
};

export type AutoReviewSummary = { approved: number; rejected: number; skipped: number };

/** Decides every pending LLM or community pick. Picks whose video text is gone are rejected. */
export async function autoReviewPending(deps: AutoReviewDeps): Promise<AutoReviewSummary> {
  const { db } = deps;
  const summary: AutoReviewSummary = { approved: 0, rejected: 0, skipped: 0 };
  const cityIds = new Map(
    (await db.select().from(schema.cities)).map((c) => [c.slug, c.id] as const),
  );

  const feeds = new Map<string, Map<string, Upload>>();
  const deepened = new Set<string>();
  async function videoText(channelId: string | null, videoId: string): Promise<Upload | undefined> {
    if (!channelId) return undefined;
    if (!feeds.has(channelId)) {
      const uploads = await deps.listUploads(channelId).catch(() => []);
      feeds.set(channelId, new Map(uploads.map((u) => [u.videoId, u])));
    }
    const feed = feeds.get(channelId)!;
    if (!feed.has(videoId) && deps.listArchive && !deepened.has(channelId)) {
      deepened.add(channelId);
      for (const u of await deps.listArchive(channelId).catch(() => [])) feed.set(u.videoId, u);
    }
    return feed.get(videoId);
  }

  summary.rejected += await admitSubmissions(db, videoText);

  const pending = await db
    .select({
      id: schema.recommendations.id,
      extracted: schema.recommendations.extracted,
      videoId: schema.sources.externalId,
      channelId: schema.creators.ytChannelId,
    })
    .from(schema.recommendations)
    .innerJoin(schema.sources, eq(schema.sources.id, schema.recommendations.sourceId))
    .innerJoin(schema.creators, eq(schema.creators.id, schema.sources.creatorId))
    .where(
      and(
        eq(schema.recommendations.status, "pending"),
        // Community suggestions pass the same video-grounding gate as LLM picks.
        inArray(schema.recommendations.origin, ["llm", "community"]),
      ),
    );

  for (const row of pending) {
    const extracted = (row.extracted ?? {}) as ExtractedPick & { suggestions?: Suggestions };
    if (!extracted.place_name || !extracted.dishes?.length) {
      await settle(db, row.id, extracted, { approve: false, reason: "not-grounded" });
      summary.rejected++;
      continue;
    }

    const video = await videoText(row.channelId, row.videoId);
    if (!video) {
      // Feed only lists the latest 15 uploads; without the text we cannot verify.
      await settle(db, row.id, extracted, { approve: false, reason: "not-grounded" });
      summary.rejected++;
      continue;
    }

    let check: PickCheck;
    try {
      check = await deps.check(video, extracted);
    } catch (error) {
      console.error(`auto-review: Jev failed for rec ${row.id}, retry next run:`, error);
      summary.skipped++;
      continue;
    }

    const decision = decidePick(extracted, check);
    if (decision.approve) {
      const cityId = cityIds.get(decision.city);
      if (cityId === undefined) {
        console.error(`auto-review: city ${decision.city} is not seeded, retry next run`);
        summary.skipped++;
      } else if (
        await publish(deps, row.id, cityId, cityBySlug(decision.city)!, extracted, check)
      ) {
        summary.approved++;
      } else summary.rejected++;
    } else {
      await settle(db, row.id, extracted, decision, check);
      summary.rejected++;
    }
  }
  await syncSubmissions(db);
  return summary;
}

/**
 * Turns pending visitor submissions into pending community picks, but only when
 * the video is in the chosen creator's own feed. The `sources` row is created
 * here, after that check, so an unchecked URL never blocks or mislabels ingest.
 * Returns how many submissions were rejected outright.
 */
async function admitSubmissions(
  db: Db,
  videoText: (channelId: string | null, videoId: string) => Promise<Upload | undefined>,
): Promise<number> {
  const rows = await db
    .select({ sub: schema.submissions, channelId: schema.creators.ytChannelId })
    .from(schema.submissions)
    .innerJoin(schema.creators, eq(schema.creators.id, schema.submissions.creatorId))
    .where(and(eq(schema.submissions.status, "pending"), eq(schema.creators.optedOut, false)));

  let rejected = 0;
  for (const { sub, channelId } of rows) {
    const video = await videoText(channelId, sub.videoId);
    if (!video) {
      await db
        .update(schema.submissions)
        .set({ status: "rejected", reason: "not-creators-video", reviewedAt: new Date() })
        .where(eq(schema.submissions.id, sub.id));
      rejected++;
      continue;
    }
    const city = cityBySlug(sub.citySlug);
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.sources)
        .values({
          platform: "youtube",
          externalId: sub.videoId,
          creatorId: sub.creatorId,
          publishedOn: video.publishedAt.toISOString().slice(0, 10),
        })
        .onConflictDoNothing();
      const [source] = await tx
        .select({ id: schema.sources.id })
        .from(schema.sources)
        .where(
          and(eq(schema.sources.platform, "youtube"), eq(schema.sources.externalId, sub.videoId)),
        );
      const [rec] = await tx
        .insert(schema.recommendations)
        .values({
          sourceId: source.id,
          status: "pending",
          origin: "community",
          tsSeconds: sub.tsSeconds,
          confidence: 0.6,
          extracted: {
            place_name: sub.placeName,
            locality: null,
            city: city?.name ?? sub.citySlug,
            dishes: [sub.dishName],
            timestamp_seconds: sub.tsSeconds,
            confidence: 0.6,
            submitted: true,
            submissionId: sub.id,
          },
        })
        .returning({ id: schema.recommendations.id });
      // Status follows the recommendation from here; see syncSubmissions.
      await tx
        .update(schema.submissions)
        .set({ recommendationId: rec.id })
        .where(eq(schema.submissions.id, sub.id));
    });
  }
  return rejected;
}

/** Copies each linked community pick's verdict back onto its submission. */
async function syncSubmissions(db: Db): Promise<void> {
  await db.execute(sql`
    update submissions s
    set status = r.status,
        reason = r.extracted->'autoReview'->>'reason',
        reviewed_at = r.reviewed_at
    from recommendations r
    where s.recommendation_id = r.id and s.status = 'pending' and r.status <> 'pending'
  `);
}

async function settle(
  db: Db,
  id: number,
  extracted: object,
  decision: Decision,
  check?: PickCheck,
): Promise<void> {
  await db
    .update(schema.recommendations)
    .set({
      status: decision.approve ? "approved" : "rejected",
      reviewedAt: new Date(),
      extracted: { ...extracted, autoReview: { ...decision, check: check ?? null } },
    })
    .where(and(eq(schema.recommendations.id, id), eq(schema.recommendations.status, "pending")));
}

async function publish(
  deps: AutoReviewDeps,
  id: number,
  cityId: number,
  city: City,
  pick: ExtractedPick & { suggestions?: Suggestions },
  check: PickCheck,
): Promise<boolean> {
  // Suggestions were matched against the city the LLM named; reuse them only for that city.
  const sameCity = cityFromName(pick.city)?.slug === city.slug;
  const placeMatch = sameCity
    ? pick.suggestions?.places?.find((m) => m.score >= REUSE_MATCH_SCORE)
    : undefined;
  const dishMatch = pick.suggestions?.dishes?.find((m) => m.score >= REUSE_MATCH_SCORE);
  const dishName = canonicalDishName(pick.dishes[0]);

  // Nominatim outside the transaction: it sleeps 1 s between calls.
  const location = placeMatch ? null : await locate(deps.geocode, pick, city);

  return deps.db
    .transaction(async (tx) => {
      // Same-name place created earlier in this run is not in the stored suggestions.
      const [sameName] = placeMatch
        ? []
        : await tx
            .select({ id: schema.places.id })
            .from(schema.places)
            .where(
              and(
                eq(schema.places.cityId, cityId),
                sql`lower(${schema.places.name}) = ${pick.place_name.trim().toLowerCase()}`,
              ),
            )
            .limit(1);
      const [sameDish] = dishMatch
        ? []
        : await tx
            .select({ id: schema.dishes.id })
            .from(schema.dishes)
            .where(sql`lower(${schema.dishes.name}) = ${dishName.toLowerCase()}`)
            .limit(1);

      const placeId =
        placeMatch?.id ??
        sameName?.id ??
        (await insertWithSlug(
          tx,
          async (slug) => {
            const [row] = await tx
              .insert(schema.places)
              .values({
                slug,
                name: pick.place_name.trim(),
                cityId,
                locality: pick.locality,
                lat: location?.lat ?? null,
                lng: location?.lng ?? null,
                osmId: location?.osmId ?? null,
              })
              .onConflictDoNothing()
              .returning();
            return row;
          },
          slugify(pick.place_name),
        ));

      const dishId =
        dishMatch?.id ??
        sameDish?.id ??
        (await insertWithSlug(
          tx,
          async (slug) => {
            const [row] = await tx
              .insert(schema.dishes)
              .values({ slug, name: dishName })
              .onConflictDoNothing()
              .returning();
            return row;
          },
          slugify(dishName),
        ));

      if (placeMatch && normalizeName(placeMatch.name) !== normalizeName(pick.place_name)) {
        await tx
          .insert(schema.placeAliases)
          .values({ placeId, alias: pick.place_name.trim() })
          .onConflictDoNothing();
      }

      await tx
        .update(schema.recommendations)
        .set({
          placeId,
          dishId,
          status: "approved",
          reviewedAt: new Date(),
          extracted: { ...pick, autoReview: { approve: true, check } },
        })
        .where(
          and(eq(schema.recommendations.id, id), eq(schema.recommendations.status, "pending")),
        );
      return true;
    })
    .catch(async (error: unknown) => {
      // recs_dedupe_uk: another pick from this video already holds place+dish.
      if (isUniqueViolation(error)) {
        await settle(deps.db, id, pick, { approve: false, reason: "duplicate" }, check);
        return false;
      }
      throw error;
    });
}

/**
 * Small shops are rarely on OpenStreetMap. Try the shop, then the locality
 * centre; the `approx:` osm_id prefix marks a neighbourhood-level pin.
 */
async function locate(
  geocode: AutoReviewDeps["geocode"],
  pick: ExtractedPick,
  city: City,
): Promise<{ lat: number; lng: number; osmId: string } | null> {
  if (!geocode) return null;
  const exact = await geocode(
    [pick.place_name, pick.locality, city.name].filter(Boolean).join(", "),
  ).catch(() => null);
  if (exact || !pick.locality) return exact;
  const area = await geocode(`${pick.locality}, ${city.name}`).catch(() => null);
  return area ? { ...area, osmId: `approx:${area.osmId}` } : null;
}

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

/** Nominatim restricted to India; callers put the city in the query. */
export const geocodeIndia = (query: string) =>
  suggestLocation(query).then((hit) =>
    hit && hit.lat >= 6 && hit.lat <= 37.5 && hit.lng >= 68 && hit.lng <= 97.5 ? hit : null,
  );
