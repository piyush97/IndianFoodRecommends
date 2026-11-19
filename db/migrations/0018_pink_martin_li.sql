ALTER TABLE "places" ADD COLUMN "opening_hours" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "opening_week" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "opening_hours_checked" date;