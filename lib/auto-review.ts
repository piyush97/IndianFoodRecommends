import { and, eq, sql } from "drizzle-orm";
import { schema, type Db } from "../db";
import type { ExtractedPick } from "./llm/extract";
import type { Match } from "./matcher";
import { insertWithSlug, suggestLocation } from "./review";
import { normalizeName, slugify } from "./text";
import type { Upload } from "./youtube";

/**
 * Replaces the human queue: Jev checks each LLM pick against the video text,
 * code applies fixed thresholds, and the pick is approved or rejected in the
 * same run. Every decision and its reason is stored in `extracted.autoReview`.
 */

export type PickCheck = {
  grounded: number; // video text names this place
  isVenue: number; // place_name is a shop/restaurant, not a dish or a person
  recommends: number; // video speaks well of it
  inDelhi: number; // place is in Delhi NCR
};

export type Decision =
  | { approve: true }
  | {
      approve: false;
      reason:
        | "not-delhi"
        | "city-unknown"
        | "not-grounded"
        | "not-a-venue"
        | "not-recommended"
        | "low-confidence"
        | "duplicate";
    };

const DELHI_NAMES = new Set([
  "delhi",
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
]);

const MIN_LLM_CONFIDENCE = 0.5;
const MIN_GROUNDED = 0.7;
const MIN_VENUE = 0.6;
const MIN_RECOMMENDS = 0.6;
const MIN_IN_DELHI_WHEN_UNSTATED = 0.8;
const REUSE_MATCH_SCORE = 0.8;

export function decidePick(pick: ExtractedPick, check: PickCheck): Decision {
  if (pick.city) {
    if (!DELHI_NAMES.has(normalizeName(pick.city))) return { approve: false, reason: "not-delhi" };
  } else if (check.inDelhi < MIN_IN_DELHI_WHEN_UNSTATED) {
    return { approve: false, reason: "city-unknown" };
  }
  if (pick.confidence < MIN_LLM_CONFIDENCE) return { approve: false, reason: "low-confidence" };
  if (check.grounded < MIN_GROUNDED) return { approve: false, reason: "not-grounded" };
  if (check.isVenue < MIN_VENUE) return { approve: false, reason: "not-a-venue" };
  if (check.recommends < MIN_RECOMMENDS) return { approve: false, reason: "not-recommended" };
  return { approve: true };
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
        in_delhi: {
          type: "noul",
          instructions: "`place_name` is located in Delhi or Delhi NCR",
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Jev request failed with status ${res.status}`);
  const { answers } = (await res.json()) as {
    answers: Record<"grounded" | "is_venue" | "recommends" | "in_delhi", { noul: number }>;
  };
  return {
    grounded: answers.grounded.noul,
    isVenue: answers.is_venue.noul,
    recommends: answers.recommends.noul,
    inDelhi: answers.in_delhi.noul,
  };
}

type Suggestions = { places?: Match[]; dishes?: Match[] };

export type AutoReviewDeps = {
  db: Db;
  listUploads: (channelId: string) => Promise<Upload[]>;
  check: (video: { title: string; description: string }, pick: ExtractedPick) => Promise<PickCheck>;
  geocode?: (query: string) => Promise<{ lat: number; lng: number; osmId: string } | null>;
};

export type AutoReviewSummary = { approved: number; rejected: number; skipped: number };

/** Decides every pending LLM pick. Picks whose video text is gone are rejected. */
export async function autoReviewPending(deps: AutoReviewDeps): Promise<AutoReviewSummary> {
  const { db } = deps;
  const summary: AutoReviewSummary = { approved: 0, rejected: 0, skipped: 0 };
  const [delhi] = await db.select().from(schema.cities).where(eq(schema.cities.slug, "delhi"));
  if (!delhi) throw new Error("city delhi is not seeded");

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
      and(eq(schema.recommendations.status, "pending"), eq(schema.recommendations.origin, "llm")),
    );

  const feeds = new Map<string, Map<string, Upload>>();
  async function videoText(channelId: string | null, videoId: string): Promise<Upload | undefined> {
    if (!channelId) return undefined;
    if (!feeds.has(channelId)) {
      const uploads = await deps.listUploads(channelId).catch(() => []);
      feeds.set(channelId, new Map(uploads.map((u) => [u.videoId, u])));
    }
    return feeds.get(channelId)!.get(videoId);
  }

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
      if (await publish(deps, row.id, delhi.id, extracted, check)) summary.approved++;
      else summary.rejected++;
    } else {
      await settle(db, row.id, extracted, decision, check);
      summary.rejected++;
    }
  }
  return summary;
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
  pick: ExtractedPick & { suggestions?: Suggestions },
  check: PickCheck,
): Promise<boolean> {
  const placeMatch = pick.suggestions?.places?.find((m) => m.score >= REUSE_MATCH_SCORE);
  const dishMatch = pick.suggestions?.dishes?.find((m) => m.score >= REUSE_MATCH_SCORE);

  // Nominatim outside the transaction: it sleeps 1 s between calls.
  const location =
    placeMatch || !deps.geocode
      ? null
      : await deps
          .geocode([pick.place_name, pick.locality, "Delhi"].filter(Boolean).join(", "))
          .catch(() => null);

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
            .where(sql`lower(${schema.dishes.name}) = ${pick.dishes[0].trim().toLowerCase()}`)
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
              .values({ slug, name: pick.dishes[0].trim() })
              .onConflictDoNothing()
              .returning();
            return row;
          },
          slugify(pick.dishes[0]),
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

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

export const geocodeDelhi = (query: string) =>
  suggestLocation(query).then((hit) =>
    hit && hit.lat >= 6 && hit.lat <= 37.5 && hit.lng >= 68 && hit.lng <= 97.5 ? hit : null,
  );
