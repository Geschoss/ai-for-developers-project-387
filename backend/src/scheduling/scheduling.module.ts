import { Module } from "@nestjs/common";

import { AccountsModule } from "../identity/accounts.module.js";
import { DatabaseModule } from "../platform/database/database.module.js";
import {
  BookSlot,
  CalendarSettingsService,
  EventTypes,
  GetPublicCalendar,
  ListSlots,
} from "./application/services.js";
import { calendarRoutesProvider } from "./http/calendar-routes-provider.js";
import { CalendarSettingsController, CalendarsController } from "./http/controllers.js";
import { adapterProviders } from "./infrastructure/adapter-providers.js";

@Module({
  controllers: [CalendarsController, CalendarSettingsController],
  imports: [AccountsModule, DatabaseModule],
  providers: [
    BookSlot,
    ListSlots,
    GetPublicCalendar,
    CalendarSettingsService,
    EventTypes,
    ...adapterProviders,
    calendarRoutesProvider,
  ],
})
export class SchedulingModule {}
