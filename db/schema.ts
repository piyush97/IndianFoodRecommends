import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const placeStatus = pgEnum("place_status", ["open", "closed", "moved"]);
export const recStatus = pgEnum("rec_status", ["pending", "approved", "rejected"]);
export const recOrigin = pgEnum("rec_origin", ["llm", "manual", "community"]);
export const platform = pgEnum("platform", ["youtube", "instagram"]);
export const runStatus = pgEnum("run_status", ["running", "ok", "failed"]);

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  state: text("state"),
  createdAt,
});

export const creators = pgTable("creators", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ytChannelId: text("yt_channel_id").unique(),
  igHandle: text("ig_handle"),
  optedOut: boolean("opted_out").notNull().default(false),
  createdAt,
});

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    platform: platform("platform").notNull(),
    // YouTube video ID / Instagram shortcode only. No titles, descriptions or
    // stats are stored (YouTube API Services policy).
    externalId: text("external_id").notNull(),
    creatorId: integer("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    publishedOn: date("published_on"),
    createdAt,
  },
  (t) => [unique("sources_platform_external_id_uk").on(t.platform, t.externalId)],
);

export const places = pgTable(
  "places",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "restrict" }),
    locality: text("locality"),
    lat: real("lat"),
    lng: real("lng"),
    osmId: text("osm_id"),
    status: placeStatus("status").notNull().default("open"),
    lastVerified: date("last_verified"),
    createdAt,
  },
  (t) => [index("places_city_idx").on(t.cityId)],
);

export const dishes = pgTable("dishes", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  cuisine: text("cuisine"),
  createdAt,
});

export const recommendations = pgTable(
  "recommendations",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    // Nullable while pending: the LLM may name a place or dish we cannot match.
    placeId: integer("place_id").references(() => places.id, {
      onDelete: "set null",
    }),
    dishId: integer("dish_id").references(() => dishes.id, {
      onDelete: "set null",
    }),
    tsSeconds: integer("ts_seconds"),
    note: text("note"),
    status: recStatus("status").notNull().default("pending"),
    origin: recOrigin("origin").notNull().default("llm"),
    confidence: real("confidence"),
    // Raw LLM pick plus matcher suggestions; the video text never lands here.
    extracted: jsonb("extracted"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [
    index("recs_status_place_idx").on(t.status, t.placeId),
    // Only matched picks dedupe: one video may yield several unmatched pending
    // picks. Videos themselves dedupe on sources(platform, external_id).
    uniqueIndex("recs_dedupe_uk")
      .on(t.sourceId, t.placeId, t.dishId, sql`coalesce(${t.tsSeconds}, -1)`)
      .where(sql`${t.placeId} is not null and ${t.dishId} is not null`),
  ],
);

export const placeAliases = pgTable(
  "place_aliases",
  {
    id: serial("id").primaryKey(),
    placeId: integer("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [unique("place_aliases_uk").on(t.placeId, t.alias)],
);

export const dishAliases = pgTable(
  "dish_aliases",
  {
    id: serial("id").primaryKey(),
    dishId: integer("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [unique("dish_aliases_uk").on(t.dishId, t.alias)],
);

/** Searches that found nothing: query text only, no IP or user id. Shows which dishes and creators to add next. */
export const searchMisses = pgTable("search_misses", {
  query: text("query").primaryKey(),
  hits: integer("hits").notNull().default(1),
  lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    placeId: integer("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message"),
    ipHash: text("ip_hash"),
    createdAt,
  },
  (t) => [index("reports_ip_created_idx").on(t.ipHash, t.createdAt)],
);

export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: serial("id").primaryKey(),
    platform: platform("platform").notNull(),
    externalId: text("external_id").notNull(),
    status: runStatus("status").notNull().default("running"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("ingest_runs_ext_idx").on(t.platform, t.externalId)],
);

/**
 * Visitor suggestions, kept apart from `sources` so an unchecked URL can never
 * block or mislabel a creator's own ingest. Auto-review turns an accepted row
 * into a normal source + recommendation.
 */
export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    videoId: text("video_id").notNull(),
    creatorId: integer("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    citySlug: text("city_slug").notNull(),
    placeName: text("place_name").notNull(),
    dishName: text("dish_name").notNull(),
    tsSeconds: integer("ts_seconds"),
    ipHash: text("ip_hash").notNull(),
    status: recStatus("status").notNull().default("pending"),
    reason: text("reason"),
    recommendationId: integer("recommendation_id").references(() => recommendations.id, {
      onDelete: "set null",
    }),
    createdAt,
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [
    index("submissions_ip_created_idx").on(t.ipHash, t.createdAt),
    index("submissions_status_idx").on(t.status),
  ],
);
