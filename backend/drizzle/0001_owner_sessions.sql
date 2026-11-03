CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"calendar_slug" text,
	"time_zone" text,
	"planning_horizon_days" integer,
	"daily_booking_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_shape" CHECK ((
        "users"."role" = 'owner'
        AND "users"."name" IS NOT NULL
        AND "users"."calendar_slug" IS NOT NULL
        AND "users"."time_zone" IS NOT NULL
        AND "users"."planning_horizon_days" IS NOT NULL
        AND "users"."daily_booking_limit" IS NOT NULL
      ) OR (
        "users"."role" = 'admin'
        AND "users"."name" IS NULL
        AND "users"."calendar_slug" IS NULL
        AND "users"."time_zone" IS NULL
        AND "users"."planning_horizon_days" IS NULL
        AND "users"."daily_booking_limit" IS NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_calendar_slug_unique" ON "users" USING btree ("calendar_slug");