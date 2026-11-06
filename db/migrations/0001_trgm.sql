-- Trigram search support (tech design §2). Hand-written: drizzle-kit does not
-- manage extensions or expression GIN indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS places_name_trgm_idx
  ON places USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dishes_name_trgm_idx
  ON dishes USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS place_aliases_alias_trgm_idx
  ON place_aliases USING gin (alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS dish_aliases_alias_trgm_idx
  ON dish_aliases USING gin (alias gin_trgm_ops);
