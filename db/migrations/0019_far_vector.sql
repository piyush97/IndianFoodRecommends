CREATE TABLE "creator_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"yt_channel_id" text NOT NULL,
	"name" text NOT NULL,
	"city_slug" text NOT NULL,
	"score" real NOT NULL,
	"evidence" jsonb NOT NULL,
	"status" "rec_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "creator_candidates_yt_channel_id_unique" UNIQUE("yt_channel_id")
);
--> statement-breakpoint
CREATE INDEX "creator_candidates_status_idx" ON "creator_candidates" USING btree ("status");