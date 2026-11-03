import type { components } from "spec/api";

import { type FieldErrors, messageByPath } from "../shared/problems";
import { timeZoneNames } from "../shared/time-zones";

type OwnerSettings = components["schemas"]["OwnerSettings"];

const minPlanningHorizonDays = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: Горизонт планирования is at most 60 days
const maxPlanningHorizonDays = 60;
const minDailyBookingLimit = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: Лимит бронирований is at most 18
const maxDailyBookingLimit = 18;

interface Draft {
  dailyBookingLimit: string;
  planningHorizonDays: string;
  timeZone: string;
}

type Checked =
  | { fields: FieldErrors; kind: "invalid" }
  | { kind: "valid"; settings: OwnerSettings };

/** A whole number inside `[min, max]`. Anything else is a field error. */
const wholeNumberInRange = (value: string, min: number, max: number): number | undefined => {
  if (!/^\d+$/u.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  if (parsed < min || parsed > max) {
    return undefined;
  }
  return parsed;
};

const rangeErrors = (draft: Draft): FieldErrors => {
  const fields: FieldErrors = {};
  const horizon = wholeNumberInRange(
    draft.planningHorizonDays,
    minPlanningHorizonDays,
    maxPlanningHorizonDays,
  );
  const limit = wholeNumberInRange(
    draft.dailyBookingLimit,
    minDailyBookingLimit,
    maxDailyBookingLimit,
  );
  if (horizon === undefined) {
    fields.planningHorizonDays = messageByPath.planningHorizonDays;
  }
  if (limit === undefined) {
    fields.dailyBookingLimit = messageByPath.dailyBookingLimit;
  }
  if (!timeZoneNames.includes(draft.timeZone)) {
    fields.timeZone = messageByPath.timeZone;
  }
  return fields;
};

/** Settings the API will accept, or the Russian field errors to show instead. */
const checked = (draft: Draft): Checked => {
  const fields = rangeErrors(draft);
  if (Object.keys(fields).length > 0) {
    return { fields, kind: "invalid" };
  }
  return {
    kind: "valid",
    settings: {
      dailyBookingLimit: Number(draft.dailyBookingLimit),
      planningHorizonDays: Number(draft.planningHorizonDays),
      timeZone: draft.timeZone,
    },
  };
};

const draftFrom = (settings: OwnerSettings): Draft => ({
  dailyBookingLimit: String(settings.dailyBookingLimit),
  planningHorizonDays: String(settings.planningHorizonDays),
  timeZone: settings.timeZone,
});

export {
  checked,
  type Draft,
  draftFrom,
  maxDailyBookingLimit,
  maxPlanningHorizonDays,
  minDailyBookingLimit,
  minPlanningHorizonDays,
  type OwnerSettings,
};
