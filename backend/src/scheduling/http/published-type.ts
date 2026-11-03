import type { components } from "spec/api";

import { durationFits, type StoredEventType } from "../domain/event-type.js";

type EventDuration = components["schemas"]["EventDuration"];
type EventType = components["schemas"]["EventType"];

const isEventDuration = (minutes: number): minutes is EventDuration => durationFits(minutes);

const durationOf = (minutes: number): EventDuration => {
  if (!isEventDuration(minutes)) {
    throw new Error("Stored duration is not a Тип события duration");
  }
  return minutes;
};

/** The contract's Тип события. A stored duration outside the enum is a programmer error. */
const publishedType = (stored: StoredEventType): EventType => ({
  description: stored.description,
  durationMinutes: durationOf(stored.durationMinutes),
  id: stored.id,
  name: stored.name,
});

export { publishedType };
