-- ifr:allow-locking-index: reports has 0 rows in prod, index build is instant.
ALTER TABLE "places" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "reports_place_open_idx" ON "reports" USING btree ("place_id","resolved_at","created_at");