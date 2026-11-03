import { problem } from "../../platform/problem.js";
import { UnknownTimeZoneError } from "../../shared-kernel/unknown-time-zone-error.js";
import { SchedulingError, type SchedulingCode } from "../domain/scheduling-error.js";

const statusByCode: Record<SchedulingCode, number> = {
  calendar_not_found: 404,
  daily_limit_reached: 409,
  event_type_not_found: 404,
  not_a_slot_start: 422,
  outside_planning_horizon: 422,
  own_calendar: 422,
  slot_in_past: 422,
  slot_taken: 409,
};

const unknownTimeZoneProblem = (): ReturnType<typeof problem> =>
  problem(400, "validation_failed", [{ message: "Unknown time zone", path: "/body/timeZone" }]);

/** Domain and kernel errors become the contract's problem+json. Anything else propagates. */
const translateScheduling = async <Result>(work: Promise<Result>): Promise<Result> => {
  try {
    const result = await work;
    return result;
  } catch (error) {
    if (error instanceof SchedulingError) {
      throw problem(statusByCode[error.code], error.code);
    }
    if (error instanceof UnknownTimeZoneError) {
      throw unknownTimeZoneProblem();
    }
    throw error;
  }
};

export { translateScheduling };
