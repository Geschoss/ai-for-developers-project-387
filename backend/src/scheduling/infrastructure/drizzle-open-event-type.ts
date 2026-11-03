import { Injectable, type Provider } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { calendars, eventTypes } from "../../platform/database/schema.js";
import { EventType } from "../domain/event-type.js";
import type { CalendarTransaction } from "../open-calendar.js";
import {
  OPEN_EVENT_TYPE,
  type OpenEventType,
  type OpenEventTypeCommand,
} from "../open-event-type.js";

/** Appends a Тип события. The duration rule lives in {@link EventType}. */
@Injectable()
class DrizzleOpenEventType implements OpenEventType {
  // The port has no instance state: the Тип события rule is EventType.open, and the row goes into the caller's transaction.
  // oxlint-disable-next-line eslint/class-methods-use-this
  public async openEventType(
    transaction: CalendarTransaction,
    command: OpenEventTypeCommand,
  ): Promise<void> {
    const eventType = EventType.open({
      description: command.description,
      durationMinutes: command.durationMinutes,
      name: command.name,
    });
    const [calendar] = await transaction
      .select({ id: calendars.id })
      .from(calendars)
      .where(eq(calendars.ownerId, command.ownerId))
      .limit(1);
    if (calendar === undefined) {
      throw new Error("Owner is missing a Календарь");
    }
    await transaction.insert(eventTypes).values({
      calendarId: calendar.id,
      description: eventType.description,
      durationMinutes: eventType.durationMinutes,
      id: eventType.id,
      name: eventType.name,
    });
  }
}

const openEventTypeProviders: Provider[] = [
  { provide: OPEN_EVENT_TYPE, useClass: DrizzleOpenEventType },
];

export { openEventTypeProviders };
