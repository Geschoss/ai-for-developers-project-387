import { DrizzleCalendarRepository } from "../../infrastructure/drizzle-calendar-repository.js";

/** Proves a scenario must not import an adapter. */
const applicationImportsInfrastructure = DrizzleCalendarRepository;

export { applicationImportsInfrastructure };
