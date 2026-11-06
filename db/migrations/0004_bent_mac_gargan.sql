CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"creator_id" integer NOT NULL,
	"city_slug" text NOT NULL,
	"place_name" text NOT NULL,
	"dish_name" text NOT NULL,
	"ts_seconds" integer,
	"ip_hash" text NOT NULL,
	"status" "rec_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"recommendation_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_ip_created_idx" ON "submissions" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");