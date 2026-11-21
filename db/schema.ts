import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  doublePrecision,
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
import type { Week } from "../lib/open-status";

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

export const creators = pgTable(
  "creators",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    ytChannelId: text("yt_channel_id").unique(),
    avatarUrl: text("avatar_url"),
    igHandle: text("ig_handle"),
    optedOut: boolean("opted_out").notNull().default(false),
    createdAt,
  },
  (t) => [index("creators_name_lower_trgm_idx").using("gin", sql`lower(${t.name}) gin_trgm_ops`)],
);

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

const geography = customType<{ data: string }>({ dataType: () => "geography(Point,4326)" });
const geometry = customType<{ data: string }>({ dataType: () => "geometry" });

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
    // Derived from lat/lng, never written. A point in metres-aware geography so ST_DWithin takes metres.
    geom: geography("geom").generatedAlwaysAs(
      sql`ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`,
    ),
    osmId: text("osm_id"),
    /** Google place ID: the one Google Maps field we may store. "none" = looked up, no confident match. */
    googlePlaceId: text("google_place_id"),
    status: placeStatus("status").notNull().default("open"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
    lastVerified: date("last_verified"),
    /** OpenStreetMap opening_hours tag, its parsed IST week (Monday first) and the day it was last checked. */
    openingHours: text("opening_hours"),
    openingWeek: jsonb("opening_week").$type<Week>(),
    openingHoursChecked: date("opening_hours_checked"),
    createdAt,
  },
  (t) => [
    index("places_city_idx").on(t.cityId),
    // PostGIS: radius, nearest-first and bounding-box lookups use this index (see lib/geo.ts).
    index("places_geom_idx").using("gist", t.geom),
    // Search compares lower(name); an index on the bare column cannot serve it.
    index("places_name_lower_trgm_idx").using("gin", sql`lower(${t.name}) gin_trgm_ops`),
  ],
);

/**
 * Named areas a visitor can type ("Chandni Chowk", "CP"), resolved without calling anyone.
 * `key` is the normalised name (lowercase, folded, punctuation gone) so lookups compare like with
 * like and need no `unaccent` extension. `source`: places = derived from places.locality,
 * manual = hand-curated, osm = imported boundaries, nominatim = a verified upstream hit we cached.
 */
export const areaSource = pgEnum("area_source", ["places", "manual", "osm", "nominatim"]);

export const areas = pgTable(
  "areas",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(),
    slug: text("slug").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    /** Places that mention this area: breaks ties between equally close names. */
    weight: integer("weight").notNull().default(1),
    source: areaSource("source").notNull().default("places"),
    osmId: text("osm_id"),
    boundary: geometry("boundary"),
    createdAt,
  },
  (t) => [
    unique("areas_city_slug_uk").on(t.cityId, t.slug),
    index("areas_city_key_idx").on(t.cityId, t.key),
    index("areas_key_trgm_idx").using("gin", t.key.op("gin_trgm_ops")),
    index("areas_boundary_idx").using("gist", t.boundary),
  ],
);

export const areaAliases = pgTable(
  "area_aliases",
  {
    id: serial("id").primaryKey(),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    key: text("key").notNull(),
  },
  (t) => [
    unique("area_aliases_uk").on(t.areaId, t.key),
    index("area_aliases_key_idx").on(t.key),
    index("area_aliases_key_trgm_idx").using("gin", t.key.op("gin_trgm_ops")),
  ],
);

export const foodWalks = pgTable(
  "food_walks",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    stopIds: jsonb("stop_ids").$type<number[]>().notNull(),
    meters: integer("meters").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("food_walks_city_slug_uk").on(t.cityId, t.slug)],
);

export const heatCells = pgTable(
  "heat_cells",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    creatorId: integer("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    cell: text("cell").notNull(),
    count: integer("count").notNull(),
    geometry: jsonb("geometry").$type<{ type: string; coordinates: unknown }>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("heat_cells_city_creator_cell_uk").on(t.cityId, t.creatorId, t.cell)],
);

export const dishes = pgTable(
  "dishes",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    cuisine: text("cuisine"),
    /** null = not classified yet; mixed = a thali or platter that can hold both. */
    diet: text("diet").$type<"veg" | "non-veg" | "mixed">(),
    createdAt,
  },
  (t) => [index("dishes_name_lower_trgm_idx").using("gin", sql`lower(${t.name}) gin_trgm_ops`)],
);

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
  (t) => [
    unique("place_aliases_uk").on(t.placeId, t.alias),
    index("place_aliases_alias_lower_trgm_idx").using("gin", sql`lower(${t.alias}) gin_trgm_ops`),
  ],
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
  (t) => [
    unique("dish_aliases_uk").on(t.dishId, t.alias),
    index("dish_aliases_alias_lower_trgm_idx").using("gin", sql`lower(${t.alias}) gin_trgm_ops`),
  ],
);

/** Searches that found nothing: query text only, no IP or user id. Shows which dishes and creators to add next. */
/** One row per worker command, so /admin/ops can show the last 30 runs. */
export const workerRuns = pgTable(
  "worker_runs",
  {
    id: serial("id").primaryKey(),
    command: text("command").notNull(),
    status: runStatus("status").notNull().default("running"),
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("worker_runs_started_idx").on(t.startedAt)],
);

/** Token buckets for rate limiting; see lib/rate-limit.ts. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  tokens: doublePrecision("tokens").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_ip_created_idx").on(t.ipHash, t.createdAt),
    index("reports_place_open_idx").on(t.placeId, t.resolvedAt, t.createdAt),
  ],
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

/**
 * YouTube channels found by `pnpm worker discover-creators`, waiting for an
 * admin. Approving one inserts a `creators` row; ingest then reads its feed.
 */
export const creatorCandidates = pgTable("creator_candidates", {
  id: serial("id").primaryKey(),
  ytChannelId: text("yt_channel_id").notNull().unique(),
  name: text("name").notNull(),
  citySlug: text("city_slug").notNull(),
  score: real("score").notNull(),
  // { queries, mentions: place names, newestUpload, subscribers }
  evidence: jsonb("evidence").notNull(),
  status: recStatus("status").notNull().default("pending"),
  createdAt,
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});
