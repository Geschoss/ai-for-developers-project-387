import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { DemoOwnerSeed } from "../../identity/demo-owner-seed.js";
import { OPEN_CALENDAR, type OpenCalendar } from "../open-calendar.js";
import { OPEN_EVENT_TYPE, type OpenEventType } from "../open-event-type.js";

/** Hands the Календарь and Тип события ports to the demo seed once both modules exist. */
@Injectable()
class DemoOwnerRegistration implements OnModuleInit {
  public constructor(
    @Inject(DemoOwnerSeed) private readonly seed: DemoOwnerSeed,
    @Inject(OPEN_CALENDAR) private readonly calendar: OpenCalendar,
    @Inject(OPEN_EVENT_TYPE) private readonly eventType: OpenEventType,
  ) {}

  public onModuleInit(): void {
    this.seed.bind({ calendar: this.calendar, eventType: this.eventType });
  }
}

export { DemoOwnerRegistration };
