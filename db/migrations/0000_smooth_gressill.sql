CREATE TYPE "public"."place_status" AS ENUM('open', 'closed', 'moved');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('youtube', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."rec_origin" AS ENUM('llm', 'manual', 'community');--> statement-breakpoint
CREATE TYPE "public"."rec_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'ok', 'failed');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"yt_channel_id" text,
	"ig_handle" text,
	"opted_out" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creators_slug_unique" UNIQUE("slug"),
	CONSTRAINT "creators_yt_channel_id_unique" UNIQUE("yt_channel_id")
);
--> statement-breakpoint
CREATE TABLE "dish_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"dish_id" integer NOT NULL,
	"alias" text NOT NULL,
	CONSTRAINT "dish_aliases_uk" UNIQUE("dish_id","alias")
);
--> statement-breakpoint
CREATE TABLE "dishes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"cuisine" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dishes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "place_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" integer NOT NULL,
	"alias" text NOT NULL,
	CONSTRAINT "place_aliases_uk" UNIQUE("place_id","alias")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"city_id" integer NOT NULL,
	"locality" text,
	"lat" real,
	"lng" real,
	"osm_id" text,
	"status" "place_status" DEFAULT 'open' NOT NULL,
	"last_verified" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"place_id" integer,
	"dish_id" integer,
	"ts_seconds" integer,
	"note" text,
	"status" "rec_status" DEFAULT 'pending' NOT NULL,
	"origin" "rec_origin" DEFAULT 'llm' NOT NULL,
	"confidence" real,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" integer NOT NULL,
	"kind" text NOT NULL,
	"message" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"creator_id" integer NOT NULL,
	"published_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_platform_external_id_uk" UNIQUE("platform","external_id")
);
--> statement-breakpoint
ALTER TABLE "dish_aliases" ADD CONSTRAINT "dish_aliases_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_aliases" ADD CONSTRAINT "place_aliases_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_runs_ext_idx" ON "ingest_runs" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "places_city_idx" ON "places" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "recs_status_place_idx" ON "recommendations" USING btree ("status","place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recs_dedupe_uk" ON "recommendations" USING btree ("source_id",coalesce("place_id", -1),coalesce("dish_id", -1),coalesce("ts_seconds", -1));--> statement-breakpoint
CREATE INDEX "reports_ip_created_idx" ON "reports" USING btree ("ip_hash","created_at");