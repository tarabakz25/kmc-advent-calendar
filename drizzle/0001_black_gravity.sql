ALTER TABLE "entry" ADD COLUMN "posted_at" timestamp;--> statement-breakpoint
UPDATE "entry" SET "posted_at" = "updated_at" WHERE "url" IS NOT NULL;
