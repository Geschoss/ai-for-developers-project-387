import { Calendar } from "../../scheduling/domain/calendar.js";

/** Proves Идентификация must not import the Планирование domain. */
const identityImportsSchedulingDomain = Calendar;

export { identityImportsSchedulingDomain };
