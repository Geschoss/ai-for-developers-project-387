import { DrizzleCalendarRepository } from "../../infrastructure/drizzle-calendar-repository.js";

/** Proves infrastructure is wired only from the Планирование module. */
const httpImportsInfrastructure = DrizzleCalendarRepository;

export { httpImportsInfrastructure };
