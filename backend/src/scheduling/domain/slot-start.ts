import type { TimeZone } from "../../shared-kernel/time-zone.js";
import { isSlotStart } from "./slot-grid.js";

/** An instant that starts a Слот of `durationMinutes` on the 30-minute grid, ending by 18:00. */
class SlotStart {
  private constructor(public readonly instant: Date) {}

  public static onGrid(
    instant: Date,
    timeZone: TimeZone,
    durationMinutes: number,
  ): SlotStart | undefined {
    if (!isSlotStart(instant, timeZone.name, durationMinutes)) {
      return undefined;
    }
    return new SlotStart(instant);
  }
}

export { SlotStart };
