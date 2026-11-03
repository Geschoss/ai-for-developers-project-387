import { Inject, Injectable } from "@nestjs/common";

import { TimeZone } from "../../shared-kernel/time-zone.js";
import { DailyBookingLimit } from "../domain/daily-booking-limit.js";
import { PlanningHorizon } from "../domain/planning-horizon.js";
import {
  CALENDAR_SETTINGS_STORE,
  type CalendarSettings,
  type CalendarSettingsStore,
} from "../domain/ports/read-queries.js";

/**
 * The three settings columns. Existing Бронирования stay: they are absolute instants, and a smaller
 * Горизонт планирования or Лимит бронирований does not remove them. This does not assemble a Календарь.
 */
@Injectable()
class CalendarSettingsService {
  public constructor(
    @Inject(CALENDAR_SETTINGS_STORE) private readonly store: CalendarSettingsStore,
  ) {}

  public async get(ownerId: string): Promise<CalendarSettings> {
    const settings = await this.store.get(ownerId);
    return settings;
  }

  public async update(ownerId: string, settings: CalendarSettings): Promise<CalendarSettings> {
    const saved = await this.store.save(ownerId, {
      dailyBookingLimit: DailyBookingLimit.parse(settings.dailyBookingLimit).perDay,
      planningHorizonDays: PlanningHorizon.parse(settings.planningHorizonDays).days,
      timeZone: TimeZone.parse(settings.timeZone).name,
    });
    return saved;
  }
}

export { CalendarSettingsService };
