/** «Now» for the Горизонт планирования and for a Слот that has already started. Tests substitute it. */
interface Clock {
  now: () => Date;
}

/** Injection token. The module binds the system clock. */
const CLOCK = Symbol("CLOCK");

export { CLOCK, type Clock };
