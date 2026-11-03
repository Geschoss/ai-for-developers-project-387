import { Calendar } from "../../scheduling/domain/calendar.js";

/** Proves Администрирование must not load the Календарь aggregate. */
const administrationImportsCalendar = Calendar;

export { administrationImportsCalendar };
