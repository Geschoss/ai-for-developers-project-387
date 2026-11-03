/** Contract codes the HTTP boundary turns into problem+json. The domain does not know the status. */
const schedulingCodes = [
  "calendar_not_found",
  "daily_limit_reached",
  "event_type_not_found",
  "not_a_slot_start",
  "outside_planning_horizon",
  "own_calendar",
  "slot_in_past",
  "slot_taken",
] as const;

type SchedulingCode = (typeof schedulingCodes)[number];

class SchedulingError extends Error {
  public constructor(public readonly code: SchedulingCode) {
    super(code);
    this.name = "SchedulingError";
  }
}

export { SchedulingError, type SchedulingCode };
