import { Inject, Injectable } from "@nestjs/common";

import { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import { CLOCK, type Clock } from "../domain/ports/clock.js";
import {
  SLOT_LIST_QUERY,
  type SlotListQuery,
  type SlotListView,
} from "../domain/ports/read-queries.js";
import { SchedulingError } from "../domain/scheduling-error.js";

/** Слоты in [`from`, `to`). Does not assemble a Календарь and does not take the booking lock. */
@Injectable()
class ListSlots {
  public constructor(
    @Inject(SLOT_LIST_QUERY) private readonly slots: SlotListQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async execute(request: {
    calendarSlug: string;
    eventTypeId: string;
    from: Date;
    to: Date;
  }): Promise<SlotListView> {
    const list = await this.slots.list({
      eventTypeId: request.eventTypeId,
      from: request.from,
      now: this.clock.now(),
      slug: CalendarSlug.parse(request.calendarSlug),
      to: request.to,
    });
    if (list === undefined) {
      throw new SchedulingError("calendar_not_found");
    }
    return list;
  }
}

export { ListSlots };
