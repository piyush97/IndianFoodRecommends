import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

if (!url && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required");
}

// One connection pool per process. `prepare: false` keeps it compatible with
// transaction-pooled endpoints (Neon/Supabase poolers).
export const client = postgres(url ?? "postgres://localhost:5432/ifr", {
  max: 5,
  prepare: false,
});

export const db = drizzle(client, { schema });
export { schema };
