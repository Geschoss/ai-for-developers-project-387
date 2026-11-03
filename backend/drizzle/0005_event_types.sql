CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE TABLE "event_types" (
	"calendar_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "event_types_duration_step" CHECK (duration_minutes >= 30 and duration_minutes <= 540 and duration_minutes % 30 = 0),
	CONSTRAINT "event_types_name_length" CHECK (char_length(name) between 1 and 100),
	CONSTRAINT "event_types_description_length" CHECK (char_length(description) between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX "bookings_calendar_start_unique";
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "end_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "event_type_id" uuid;
--> statement-breakpoint
INSERT INTO "event_types" ("id", "calendar_id", "name", "description", "duration_minutes")
SELECT gen_random_uuid(), "calendars"."id", 'Звонок', 'Звонок на 30 минут', 30
FROM "calendars"
WHERE EXISTS (
	SELECT 1 FROM "bookings" WHERE "bookings"."calendar_id" = "calendars"."id"
);
--> statement-breakpoint
UPDATE "bookings"
SET
	"event_type_id" = "event_types"."id",
	"end_at" = "bookings"."start_at" + interval '30 minutes'
FROM "event_types"
WHERE "event_types"."calendar_id" = "bookings"."calendar_id";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "end_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "event_type_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_end_after_start" CHECK (end_at > start_at);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist (
	calendar_id WITH =,
	tstzrange(start_at, end_at, '[)') WITH &&
);
