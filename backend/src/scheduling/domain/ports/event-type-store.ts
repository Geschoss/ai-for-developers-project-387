import type { EventType, StoredEventType } from "../event-type.js";

/** Writes and lists Типы событий without assembling a Календарь. */
interface EventTypeStore {
  add: (ownerId: string, eventType: EventType) => Promise<StoredEventType>;
  list: (ownerId: string) => Promise<StoredEventType[]>;
}

const EVENT_TYPE_STORE = Symbol("EVENT_TYPE_STORE");

export { EVENT_TYPE_STORE, type EventTypeStore };
