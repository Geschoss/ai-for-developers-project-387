CREATE TABLE "calendars" (
	"daily_booking_limit" integer NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"planning_horizon_days" integer NOT NULL,
	"slug" text NOT NULL,
	"time_zone" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendars_owner_unique" ON "calendars" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendars_slug_unique" ON "calendars" USING btree ("slug");--> statement-breakpoint
INSERT INTO "calendars" ("id", "owner_id", "slug", "time_zone", "planning_horizon_days", "daily_booking_limit")
SELECT gen_random_uuid(), "id", "calendar_slug", "time_zone", "planning_horizon_days", "daily_booking_limit"
FROM "users"
WHERE "role" = 'owner';
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "calendar_id" uuid;--> statement-breakpoint
UPDATE "bookings"
SET "calendar_id" = "calendars"."id"
FROM "calendars"
WHERE "calendars"."owner_id" = "bookings"."owner_id";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "calendar_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_owner_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "bookings_owner_start_unique";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_calendar_start_unique" ON "bookings" USING btree ("calendar_id","start_at");--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_shape";--> statement-breakpoint
DROP INDEX "users_calendar_slug_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "calendar_slug";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "daily_booking_limit";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "planning_horizon_days";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "time_zone";
