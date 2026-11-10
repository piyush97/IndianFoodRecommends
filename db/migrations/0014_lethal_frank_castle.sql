-- ifr:allow-locking-index: every table here is under 10k rows, so the brief lock is safe.
CREATE INDEX "creators_name_lower_trgm_idx" ON "creators" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dish_aliases_alias_lower_trgm_idx" ON "dish_aliases" USING gin (lower("alias") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dishes_name_lower_trgm_idx" ON "dishes" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "place_aliases_alias_lower_trgm_idx" ON "place_aliases" USING gin (lower("alias") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "places_name_lower_trgm_idx" ON "places" USING gin (lower("name") gin_trgm_ops);