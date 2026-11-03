import { Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";

import { bookings, calendars, eventTypes, users } from "../../platform/database/schema.js";
import type { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import { Calendar } from "../domain/calendar.js";
import type { CalendarRepository } from "../domain/ports/calendar-repository.js";
import { SchedulingError } from "../domain/scheduling-error.js";
import { civilDayBounds } from "../domain/slot-grid.js";
import { currentTransaction, type Transaction } from "./transaction-context.js";

interface CalendarRow {
  calendarId: string;
  dailyBookingLimit: number;
  ownerId: string;
  ownerName: string | null;
  planningHorizonDays: number;
  timeZone: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Exclusion `bookings_no_overlap` is the guarantee; this only names the error (ADR-0003, ADR-0009). */
const slotAlreadyTaken = (error: unknown): boolean => {
  if (!isRecord(error) || !isRecord(error["cause"])) {
    return false;
  }
  return (
    error["cause"]["code"] === "23P01" && error["cause"]["constraint"] === "bookings_no_overlap"
  );
};

const requireName = (row: CalendarRow): CalendarRow & { ownerName: string } => {
  if (row.ownerName === null) {
    throw new Error("Owner is missing a name");
  }
  return { ...row, ownerName: row.ownerName };
};

const dayBookings = async (
  transaction: Transaction,
  calendarId: string,
  day: { from: Date; to: Date },
): Promise<
  {
    endAt: Date;
    eventTypeId: string;
    guestEmail: string;
    guestName: string;
    id: string;
    startAt: Date;
  }[]
> => {
  const rows = await transaction
    .select({
      endAt: bookings.endAt,
      eventTypeId: bookings.eventTypeId,
      guestEmail: bookings.guestEmail,
      guestName: bookings.guestName,
      id: bookings.id,
      startAt: bookings.startAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.calendarId, calendarId),
        gte(bookings.startAt, day.from),
        lt(bookings.startAt, day.to),
      ),
    );
  return rows;
};

const storedTypes = async (
  transaction: Transaction,
  calendarId: string,
): Promise<{ description: string; durationMinutes: number; id: string; name: string }[]> => {
  const rows = await transaction
    .select({
      description: eventTypes.description,
      durationMinutes: eventTypes.durationMinutes,
      id: eventTypes.id,
      name: eventTypes.name,
    })
    .from(eventTypes)
    .where(eq(eventTypes.calendarId, calendarId));
  return rows;
};

/** Loads one civil day under `SELECT … FOR UPDATE` of the Календарь and inserts only the Бронирования `book` added. */
@Injectable()
class DrizzleCalendarRepository implements CalendarRepository {
  private readonly openTransaction = currentTransaction;

  public async loadLocked(slug: CalendarSlug, startAt: Date): Promise<Calendar | undefined> {
    const transaction = this.openTransaction();
    const [row] = await transaction
      .select({
        calendarId: calendars.id,
        dailyBookingLimit: calendars.dailyBookingLimit,
        ownerId: calendars.ownerId,
        ownerName: users.name,
        planningHorizonDays: calendars.planningHorizonDays,
        timeZone: calendars.timeZone,
      })
      .from(calendars)
      .innerJoin(users, eq(users.id, calendars.ownerId))
      .where(eq(calendars.slug, slug.value))
      .limit(1)
      .for("update", { of: calendars });
    if (row === undefined) {
      return undefined;
    }
    const calendar = requireName(row);
    const day = civilDayBounds(startAt, calendar.timeZone);
    return Calendar.load({
      bookings: await dayBookings(transaction, calendar.calendarId, day),
      dailyBookingLimit: calendar.dailyBookingLimit,
      dayFrom: day.from,
      dayTo: day.to,
      eventTypes: await storedTypes(transaction, calendar.calendarId),
      id: calendar.calendarId,
      ownerId: calendar.ownerId,
      ownerName: calendar.ownerName,
      planningHorizonDays: calendar.planningHorizonDays,
      slug: slug.value,
      timeZone: calendar.timeZone,
    });
  }

  public async save(calendar: Calendar): Promise<void> {
    const added = calendar.addedBookings();
    if (added.length === 0) {
      return;
    }
    const transaction = this.openTransaction();
    try {
      await transaction.insert(bookings).values(
        added.map((booking) => ({
          calendarId: calendar.id,
          endAt: booking.endAt,
          eventTypeId: booking.eventTypeId,
          guestEmail: booking.guestEmail,
          guestName: booking.guestName,
          id: booking.id,
          startAt: booking.startAt,
        })),
      );
    } catch (error) {
      if (slotAlreadyTaken(error)) {
        throw new SchedulingError("slot_taken");
      }
      throw error;
    }
  }
}

export { DrizzleCalendarRepository };
