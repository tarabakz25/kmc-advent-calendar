ALTER TABLE "entry" DROP CONSTRAINT "entry_year_day_unique";--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "cal" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_year_cal_day_unique" UNIQUE("year","cal","day");--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_cal_range" CHECK ("entry"."cal" >= 1);