import type { TimeZone } from "../../shared-kernel/time-zone.js";
import { withinPlanningHorizon } from "./slot-grid.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the shortest Горизонт планирования is 1 day
const minimumHorizonDays = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the longest Горизонт планирования is 60 days
const maximumHorizonDays = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Календарь starts with a horizon of 14 days
const openingHorizonDays = 14;

/** How many civil days, including today, a Гость may book. */
class PlanningHorizon {
  private constructor(public readonly days: number) {}

  public static parse(days: number): PlanningHorizon {
    if (!Number.isInteger(days) || days < minimumHorizonDays || days > maximumHorizonDays) {
      throw new Error(`Planning horizon ${String(days)} is outside 1..60`);
    }
    return new PlanningHorizon(days);
  }

  /** The Горизонт планирования registration gives a new Календарь. */
  public static opening(): PlanningHorizon {
    return PlanningHorizon.parse(openingHorizonDays);
  }

  /** Today counts. The day after the horizon does not. */
  public includes(start: Date, now: Date, timeZone: TimeZone): boolean {
    return withinPlanningHorizon({
      now,
      planningHorizonDays: this.days,
      start,
      timeZone: timeZone.name,
    });
  }
}

export { PlanningHorizon };
