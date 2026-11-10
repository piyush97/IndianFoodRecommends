-- ifr:allow-locking-index: every table here is under 10k rows, so the brief lock is safe.
ALTER TABLE "areas" ADD COLUMN "osm_id" text;--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "boundary" geometry;--> statement-breakpoint
CREATE INDEX "areas_boundary_idx" ON "areas" USING gist ("boundary");
