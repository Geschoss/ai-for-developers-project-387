import { Inject, Injectable } from "@nestjs/common";

import { EventType, type EventTypeDraft, type StoredEventType } from "../domain/event-type.js";
import { EVENT_TYPE_STORE, type EventTypeStore } from "../domain/ports/event-type-store.js";

/**
 * Типы событий of one Владелец. Creating one does not assemble a Календарь and does not touch
 * Бронирования (ADR-0006).
 */
@Injectable()
class EventTypes {
  public constructor(@Inject(EVENT_TYPE_STORE) private readonly store: EventTypeStore) {}

  public async create(ownerId: string, draft: EventTypeDraft): Promise<StoredEventType> {
    const created = await this.store.add(ownerId, EventType.open(draft));
    return created;
  }

  public async list(ownerId: string): Promise<StoredEventType[]> {
    const eventTypes = await this.store.list(ownerId);
    return eventTypes;
  }
}

export { EventTypes };
