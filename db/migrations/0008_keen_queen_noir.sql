CREATE EXTENSION IF NOT EXISTS cube;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS earthdistance;--> statement-breakpoint
CREATE INDEX "places_geo_idx" ON "places" USING gist (ll_to_earth("lat", "lng"));
