import type { CalendarTransaction } from "./open-calendar.js";

interface OpenEventTypeCommand {
  description: string;
  durationMinutes: number;
  name: string;
  ownerId: string;
}

/**
 * Port Планирования that appends a Тип события inside the caller's transaction.
 * It lives beside the module, not under `domain/`: Идентификация calls it and must not import the domain.
 */
interface OpenEventType {
  openEventType: (transaction: CalendarTransaction, command: OpenEventTypeCommand) => Promise<void>;
}

/** Injection token. The Планирование module binds the Drizzle adapter and hands it to the demo seed. */
const OPEN_EVENT_TYPE = Symbol("OPEN_EVENT_TYPE");

export { OPEN_EVENT_TYPE, type OpenEventType, type OpenEventTypeCommand };
