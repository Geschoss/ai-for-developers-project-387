/** The transaction a booking runs in. The scenario loads, books, and saves inside `run`. */
interface UnitOfWork {
  run: <Result>(work: () => Promise<Result>) => Promise<Result>;
}

/** Injection token. The module binds the Drizzle adapter. */
const UNIT_OF_WORK = Symbol("UNIT_OF_WORK");

export { UNIT_OF_WORK, type UnitOfWork };
