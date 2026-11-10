-- ifr:allow-locking-index: worker_runs is created empty in this same migration, so the index lock is instant.
CREATE TABLE "worker_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"command" text NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"summary" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "worker_runs_started_idx" ON "worker_runs" USING btree ("started_at");