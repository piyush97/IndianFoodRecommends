-- Drizzle generated this file twice for work already merged: 0011 adds the areas
-- columns and index, 0012 creates food_walks and heat_cells. Recreating them made
-- every fresh database (CI, a new deploy) fail here, so only rate_limits is kept.
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
