CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
DROP INDEX IF EXISTS "places_geo_idx";--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "geom" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_geom_idx" ON "places" USING gist ("geom");--> statement-breakpoint
DROP EXTENSION IF EXISTS earthdistance;--> statement-breakpoint
DROP EXTENSION IF EXISTS cube;
