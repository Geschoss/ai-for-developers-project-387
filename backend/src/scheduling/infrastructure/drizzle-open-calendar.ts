import { randomUUID } from "node:crypto";

import { Injectable, type Provider } from "@nestjs/common";

import { calendars } from "../../platform/database/schema.js";
import { DailyBookingLimit } from "../domain/daily-booking-limit.js";
import { PlanningHorizon } from "../domain/planning-horizon.js";
import {
  OPEN_CALENDAR,
  type CalendarTransaction,
  type OpenCalendar,
  type OpenCalendarCommand,
} from "../open-calendar.js";
import { OpenCalendarRegistration } from "./open-calendar-registration.js";

/** Inserts the Календарь. The opening horizon and limit come from Планирование (ADR-0008). */
@Injectable()
class DrizzleOpenCalendar implements OpenCalendar {
  private readonly newId = randomUUID;

  public async openCalendar(
    transaction: CalendarTransaction,
    command: OpenCalendarCommand,
  ): Promise<void> {
    await transaction.insert(calendars).values({
      dailyBookingLimit: DailyBookingLimit.opening().perDay,
      id: this.newId(),
      ownerId: command.ownerId,
      planningHorizonDays: PlanningHorizon.opening().days,
      slug: command.slug,
      timeZone: command.timeZone,
    });
  }
}

const openCalendarProviders: Provider[] = [
  { provide: OPEN_CALENDAR, useClass: DrizzleOpenCalendar },
  OpenCalendarRegistration,
];

export { openCalendarProviders };
