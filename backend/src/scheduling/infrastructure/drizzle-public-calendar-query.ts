import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { calendars, eventTypes, users } from "../../platform/database/schema.js";
import type { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import type {
  PublicCalendarQuery,
  PublicCalendarView,
  PublicEventType,
} from "../domain/ports/read-queries.js";

interface CalendarRow {
  description: string | null;
  durationMinutes: number | null;
  eventTypeId: string | null;
  eventTypeName: string | null;
  ownerName: string | null;
  planningHorizonDays: number;
  timeZone: string;
}

const eventTypesOf = (rows: readonly CalendarRow[]): PublicEventType[] =>
  rows.flatMap((row) => {
    if (
      row.eventTypeId === null ||
      row.eventTypeName === null ||
      row.description === null ||
      row.durationMinutes === null
    ) {
      return [];
    }
    return [
      {
        description: row.description,
        durationMinutes: row.durationMinutes,
        id: row.eventTypeId,
        name: row.eventTypeName,
      },
    ];
  });

const requirePublic = (rows: readonly CalendarRow[]): PublicCalendarView => {
  const [first] = rows;
  if (first === undefined || first.ownerName === null) {
    throw new Error("Owner is missing a name");
  }
  return {
    eventTypes: eventTypesOf(rows),
    ownerName: first.ownerName,
    planningHorizonDays: first.planningHorizonDays,
    timeZone: first.timeZone,
  };
};

/** The public page. No lock, no Бронирования. Типы событий are listed in creation order. */
@Injectable()
class DrizzlePublicCalendarQuery implements PublicCalendarQuery {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async find(slug: CalendarSlug): Promise<PublicCalendarView | undefined> {
    const rows = await this.db
      .select({
        description: eventTypes.description,
        durationMinutes: eventTypes.durationMinutes,
        eventTypeId: eventTypes.id,
        eventTypeName: eventTypes.name,
        ownerName: users.name,
        planningHorizonDays: calendars.planningHorizonDays,
        timeZone: calendars.timeZone,
      })
      .from(calendars)
      .innerJoin(users, eq(users.id, calendars.ownerId))
      .leftJoin(eventTypes, eq(eventTypes.calendarId, calendars.id))
      .where(eq(calendars.slug, slug.value))
      .orderBy(asc(eventTypes.createdAt));
    if (rows.length === 0) {
      return undefined;
    }
    return requirePublic(rows);
  }
}

export { DrizzlePublicCalendarQuery };
