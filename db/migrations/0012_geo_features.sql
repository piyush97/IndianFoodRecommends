CREATE TABLE "food_walks" (
  "id" serial PRIMARY KEY,
  "city_id" integer NOT NULL REFERENCES "cities"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "stop_ids" jsonb NOT NULL CHECK (jsonb_array_length("stop_ids") BETWEEN 4 AND 5),
  "meters" integer NOT NULL CHECK ("meters" >= 0),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "food_walks_city_slug_uk" UNIQUE ("city_id","slug")
);--> statement-breakpoint
CREATE TABLE "heat_cells" (
  "id" serial PRIMARY KEY,
  "city_id" integer NOT NULL REFERENCES "cities"("id") ON DELETE CASCADE,
  "creator_id" integer NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "cell" text NOT NULL,
  "count" integer NOT NULL CHECK ("count" > 0),
  "geometry" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "heat_cells_city_creator_cell_uk" UNIQUE ("city_id","creator_id","cell")
);
