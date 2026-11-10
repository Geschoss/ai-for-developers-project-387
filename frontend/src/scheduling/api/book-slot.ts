import type { components } from "spec/api";

import { api } from "../../shared/api";
import { errorsFor, type FieldErrors } from "../../shared/problems";

type BookingConfirmation = components["schemas"]["BookingConfirmation"];

interface GuestDraft {
  email: string;
  name: string;
  note: string;
}

type BookingOutcome =
  | { confirmation: BookingConfirmation; kind: "booked" }
  | { fields: FieldErrors; form: string | undefined; kind: "rejected"; taken: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSlotTaken = (error: unknown): boolean => isRecord(error) && error["code"] === "slot_taken";

const bookSlot = async (booking: {
  calendarSlug: string;
  eventTypeId: string;
  guest: GuestDraft;
  startAt: string;
}): Promise<BookingOutcome> => {
  const result = await api.POST("/api/calendars/{calendarSlug}/bookings", {
    body: {
      eventTypeId: booking.eventTypeId,
      guest: { email: booking.guest.email, name: booking.guest.name },
      note: booking.guest.note,
      startAt: booking.startAt,
    },
    params: { path: { calendarSlug: booking.calendarSlug } },
  });
  if (result.data !== undefined) {
    return { confirmation: result.data, kind: "booked" };
  }
  const shown = errorsFor(result.error);
  return {
    fields: shown.fields,
    form: shown.form,
    kind: "rejected",
    taken: isSlotTaken(result.error),
  };
};

export { type BookingConfirmation, type BookingOutcome, type GuestDraft, bookSlot };
