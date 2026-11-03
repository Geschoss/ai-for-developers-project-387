import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import { calendars } from "../../platform/database/schema.js";
import type { CalendarSettings, CalendarSettingsStore } from "../domain/ports/read-queries.js";

const settingsFrom = (row: CalendarSettings | undefined): CalendarSettings => {
  if (row === undefined) {
    throw new Error("Owner is missing calendar settings");
  }
  return row;
};

/** Reads and replaces the three settings columns. Does not touch Бронирования. */
@Injectable()
class DrizzleCalendarSettings implements CalendarSettingsStore {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async get(ownerId: string): Promise<CalendarSettings> {
    const [row] = await this.db
      .select({
        dailyBookingLimit: calendars.dailyBookingLimit,
        planningHorizonDays: calendars.planningHorizonDays,
        timeZone: calendars.timeZone,
      })
      .from(calendars)
      .where(eq(calendars.ownerId, ownerId))
      .limit(1);
    return settingsFrom(row);
  }

  public async save(ownerId: string, settings: CalendarSettings): Promise<CalendarSettings> {
    const [row] = await this.db
      .update(calendars)
      .set({
        dailyBookingLimit: settings.dailyBookingLimit,
        planningHorizonDays: settings.planningHorizonDays,
        timeZone: settings.timeZone,
      })
      .where(eq(calendars.ownerId, ownerId))
      .returning({
        dailyBookingLimit: calendars.dailyBookingLimit,
        planningHorizonDays: calendars.planningHorizonDays,
        timeZone: calendars.timeZone,
      });
    return settingsFrom(row);
  }
}

export { DrizzleCalendarSettings };
