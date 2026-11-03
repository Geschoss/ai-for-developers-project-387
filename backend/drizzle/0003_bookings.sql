CREATE TABLE "bookings" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"guest_email" text NOT NULL,
	"guest_name" text NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_owner_start_unique" ON "bookings" USING btree ("owner_id","start_at");