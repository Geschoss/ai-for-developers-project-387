import { randomUUID } from "node:crypto";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the shortest Тип события is 30 minutes
const minimumDurationMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: 09:00–18:00 is 540 minutes
const maximumDurationMinutes = 540;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: duration steps by 30 minutes
const durationStepMinutes = 30;
const minimumTextLength = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a Тип события name is at most 100 characters
const maximumNameLength = 100;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a Тип события description is at most 1000 characters
const maximumDescriptionLength = 1000;
// oxlint-disable-next-line eslint/no-magic-numbers -- seconds in a minute
const secondsPerMinute = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- milliseconds in a second
const msPerSecond = 1000;

interface StoredEventType {
  description: string;
  durationMinutes: number;
  id: string;
  name: string;
}

interface EventTypeDraft {
  description: string;
  durationMinutes: number;
  name: string;
}

const durationFits = (minutes: number): boolean =>
  Number.isInteger(minutes) &&
  minutes >= minimumDurationMinutes &&
  minutes <= maximumDurationMinutes &&
  minutes % durationStepMinutes === 0;

const textFits = (value: string, maximum: number): boolean =>
  value.length >= minimumTextLength && value.length <= maximum;

/** A bookable kind on one Календарь. Its duration is the length of a Слот. */
class EventType {
  public readonly description: string;
  public readonly durationMinutes: number;
  public readonly id: string;
  public readonly name: string;

  private constructor(fields: StoredEventType) {
    this.description = fields.description;
    this.durationMinutes = fields.durationMinutes;
    this.id = fields.id;
    this.name = fields.name;
  }

  /** A new Тип события. The server chooses the id. */
  public static open(draft: EventTypeDraft): EventType {
    if (!textFits(draft.name, maximumNameLength)) {
      throw new Error("Event type name length is outside 1..100");
    }
    if (!textFits(draft.description, maximumDescriptionLength)) {
      throw new Error("Event type description length is outside 1..1000");
    }
    if (!durationFits(draft.durationMinutes)) {
      throw new Error("Event type duration must be 30..540 and a multiple of 30");
    }
    return new EventType({ ...draft, id: randomUUID() });
  }

  /** A Тип события already stored. Invalid columns are a programmer error. */
  public static restore(fields: StoredEventType): EventType {
    if (!textFits(fields.name, maximumNameLength)) {
      throw new Error("Stored event type name length is outside 1..100");
    }
    if (!textFits(fields.description, maximumDescriptionLength)) {
      throw new Error("Stored event type description length is outside 1..1000");
    }
    if (!durationFits(fields.durationMinutes)) {
      throw new Error("Stored event type duration must be 30..540 and a multiple of 30");
    }
    return new EventType(fields);
  }

  /** Exclusive end of a Слот that starts at `start`. */
  public endsAt(start: Date): Date {
    return new Date(start.getTime() + this.durationMinutes * secondsPerMinute * msPerSecond);
  }
}

export { EventType, type EventTypeDraft, type StoredEventType, durationFits };
