ALTER TABLE "areas" ADD COLUMN "osm_id" text;--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "boundary" geometry;--> statement-breakpoint
CREATE INDEX "areas_boundary_idx" ON "areas" USING gist ("boundary");
