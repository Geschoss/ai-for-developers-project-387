import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { AccountsService } from "../../identity/accounts.service.js";
import { OPEN_CALENDAR, type OpenCalendar } from "../open-calendar.js";

/** Hands the port to Идентификация once both modules exist. */
@Injectable()
class OpenCalendarRegistration implements OnModuleInit {
  public constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(OPEN_CALENDAR) private readonly openCalendar: OpenCalendar,
  ) {}

  public onModuleInit(): void {
    this.accounts.bindOpenCalendar(this.openCalendar);
  }
}

export { OpenCalendarRegistration };
