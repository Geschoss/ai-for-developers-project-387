import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, lt } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { bookings, calendars, eventTypes } from "../../platform/database/schema.js";
import { intervalsOverlap } from "../domain/booking.js";
import type { SlotListQuery, SlotListRequest, SlotListView } from "../domain/ports/read-queries.js";
import { SchedulingError } from "../domain/scheduling-error.js";
import { bookableSlots } from "../domain/slot-grid.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- seconds in a minute
const secondsPerMinute = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- milliseconds in a second
const msPerSecond = 1000;

interface TakenInterval {
  endAt: Date;
  startAt: Date;
}

type SlotStatus = SlotListView["slots"][number]["status"];

const slotEnd = (start: Date, durationMinutes: number): Date =>
  new Date(start.getTime() + durationMinutes * secondsPerMinute * msPerSecond);

const statusOf = (start: Date, end: Date, taken: readonly TakenInterval[]): SlotStatus => {
  const overlaps = taken.some((booking) =>
    intervalsOverlap({ end, start }, { end: booking.endAt, start: booking.startAt }),
  );
  if (overlaps) {
    return "booked";
  }
  return "free";
};

interface CalendarType {
  calendarId: string;
  durationMinutes: number | null;
  planningHorizonDays: number;
  timeZone: string;
}

const requireDuration = (calendar: CalendarType): number => {
  if (calendar.durationMinutes === null) {
    throw new SchedulingError("event_type_not_found");
  }
  return calendar.durationMinutes;
};

/**
 * Слоты of one Тип события that start in [`from`, `to`).
 * Already started and those outside the horizon are omitted.
 * `booked` is any Бронирование whose interval overlaps the Слот. The guest who booked is not included.
 */
@Injectable()
class DrizzleSlotListQuery implements SlotListQuery {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async list(request: SlotListRequest): Promise<SlotListView | undefined> {
    const { eventTypeId, from, now, slug, to } = request;
    const [calendar] = await this.db
      .select({
        calendarId: calendars.id,
        durationMinutes: eventTypes.durationMinutes,
        planningHorizonDays: calendars.planningHorizonDays,
        timeZone: calendars.timeZone,
      })
      .from(calendars)
      .leftJoin(
        eventTypes,
        and(eq(eventTypes.calendarId, calendars.id), eq(eventTypes.id, eventTypeId)),
      )
      .where(eq(calendars.slug, slug.value))
      .limit(1);
    if (calendar === undefined) {
      return undefined;
    }
    const durationMinutes = requireDuration(calendar);
    const taken = await this.db
      .select({ endAt: bookings.endAt, startAt: bookings.startAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.calendarId, calendar.calendarId),
          lt(bookings.startAt, to),
          gt(bookings.endAt, from),
        ),
      );
    const slots = bookableSlots({
      durationMinutes,
      from,
      now,
      planningHorizonDays: calendar.planningHorizonDays,
      timeZone: calendar.timeZone,
      to,
    }).map((startAt) => ({
      startAt: startAt.toISOString(),
      status: statusOf(startAt, slotEnd(startAt, durationMinutes), taken),
    }));
    return { slots };
  }
}

export { DrizzleSlotListQuery };
