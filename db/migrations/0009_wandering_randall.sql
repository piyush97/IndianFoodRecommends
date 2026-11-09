CREATE TYPE "public"."area_source" AS ENUM('places', 'manual', 'osm', 'nominatim');--> statement-breakpoint
CREATE TABLE "area_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_id" integer NOT NULL,
	"alias" text NOT NULL,
	"key" text NOT NULL,
	CONSTRAINT "area_aliases_uk" UNIQUE("area_id","key")
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"slug" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"source" "area_source" DEFAULT 'places' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "areas_city_slug_uk" UNIQUE("city_id","slug")
);
--> statement-breakpoint
ALTER TABLE "area_aliases" ADD CONSTRAINT "area_aliases_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "area_aliases_key_idx" ON "area_aliases" USING btree ("key");--> statement-breakpoint
CREATE INDEX "area_aliases_key_trgm_idx" ON "area_aliases" USING gin ("key" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "areas_city_key_idx" ON "areas" USING btree ("city_id","key");--> statement-breakpoint
CREATE INDEX "areas_key_trgm_idx" ON "areas" USING gin ("key" gin_trgm_ops);