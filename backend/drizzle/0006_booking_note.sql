ALTER TABLE "bookings" ADD COLUMN "note" text;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_note_length" CHECK ("note" is null or char_length("note") between 1 and 500);
