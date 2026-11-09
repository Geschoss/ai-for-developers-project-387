import { Inject, Injectable } from "@nestjs/common";
import type { components } from "spec/api";

import { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import type { Calendar } from "../domain/calendar.js";
import {
  CALENDAR_REPOSITORY,
  type CalendarRepository,
} from "../domain/ports/calendar-repository.js";
import { CLOCK, type Clock } from "../domain/ports/clock.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../domain/ports/unit-of-work.js";
import { SchedulingError } from "../domain/scheduling-error.js";
import type { Viewer } from "../domain/viewer.js";
import { normalizeNote } from "./booking-note.js";

type BookingConfirmation = components["schemas"]["BookingConfirmation"];
type BookingRequest = components["schemas"]["BookingRequest"];

const booked = (calendar: Calendar, startAt: Date, note: string | null): BookingConfirmation => ({
  note,
  ownerName: calendar.ownerName,
  ownerTimeZone: calendar.timeZone.name,
  startAt: startAt.toISOString(),
});

/**
 * Books one Слот of the chosen Тип события. The Календарь is loaded already locked, then `book`, then save.
 * The exclusion constraint remains the backstop when two Гости pass the in-memory check (ADR-0003, ADR-0009).
 */
@Injectable()
class BookSlot {
  public constructor(
    @Inject(CALENDAR_REPOSITORY) private readonly calendars: CalendarRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async execute(
    calendarSlug: string,
    booking: BookingRequest,
    viewer: Viewer | undefined,
  ): Promise<BookingConfirmation> {
    const slug = CalendarSlug.parse(calendarSlug);
    const startAt = new Date(booking.startAt);
    const note = normalizeNote(booking.note);
    const now = this.clock.now();
    const confirmation = await this.unitOfWork.run(async () => {
      const calendar = await this.lockedCalendar(slug, startAt);
      calendar.book({
        eventTypeId: booking.eventTypeId,
        guestEmail: booking.guest.email,
        guestName: booking.guest.name,
        note,
        now,
        startAt,
        viewer,
      });
      await this.calendars.save(calendar);
      return booked(calendar, startAt, note);
    });
    return confirmation;
  }

  private async lockedCalendar(slug: CalendarSlug, startAt: Date): Promise<Calendar> {
    const calendar = await this.calendars.loadLocked(slug, startAt);
    if (calendar === undefined) {
      throw new SchedulingError("calendar_not_found");
    }
    return calendar;
  }
}

export { BookSlot };
