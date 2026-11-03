import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { calendars, eventTypes } from "../../platform/database/schema.js";
import type { EventType, StoredEventType } from "../domain/event-type.js";
import type { EventTypeStore } from "../domain/ports/event-type-store.js";

const storedFrom = (row: StoredEventType | undefined): StoredEventType => {
  if (row === undefined) {
    throw new Error("Тип события was not stored");
  }
  return row;
};

/** Appends and lists Типы событий. Does not lock the Календарь and does not touch Бронирования. */
@Injectable()
class DrizzleEventTypeStore implements EventTypeStore {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async add(ownerId: string, eventType: EventType): Promise<StoredEventType> {
    const [calendar] = await this.db
      .select({ id: calendars.id })
      .from(calendars)
      .where(eq(calendars.ownerId, ownerId))
      .limit(1);
    if (calendar === undefined) {
      throw new Error("Owner is missing a Календарь");
    }
    const [row] = await this.db
      .insert(eventTypes)
      .values({
        calendarId: calendar.id,
        description: eventType.description,
        durationMinutes: eventType.durationMinutes,
        id: eventType.id,
        name: eventType.name,
      })
      .returning({
        description: eventTypes.description,
        durationMinutes: eventTypes.durationMinutes,
        id: eventTypes.id,
        name: eventTypes.name,
      });
    return storedFrom(row);
  }

  public async list(ownerId: string): Promise<StoredEventType[]> {
    const rows = await this.db
      .select({
        description: eventTypes.description,
        durationMinutes: eventTypes.durationMinutes,
        id: eventTypes.id,
        name: eventTypes.name,
      })
      .from(eventTypes)
      .innerJoin(calendars, eq(eventTypes.calendarId, calendars.id))
      .where(eq(calendars.ownerId, ownerId))
      .orderBy(asc(eventTypes.createdAt));
    return rows;
  }
}

export { DrizzleEventTypeStore };
