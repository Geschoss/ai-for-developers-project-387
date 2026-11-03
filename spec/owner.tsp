import "@typespec/http";

using Http;

namespace CallCalendar;

/** Настройки календаря Владельца. Их изменение не трогает существующие Бронирования. */
model OwnerSettings {
  timeZone: TimeZone;
  planningHorizonDays: PlanningHorizon;
  dailyBookingLimit: DailyBookingLimit;
}

/** Настройки текущего Владельца. */
@tag("Владелец")
@route("/api/owner/settings")
@get
@useAuth(SessionCookie)
op getOwnerSettings(): OwnerSettings | Unauthenticated | Forbidden;

/** Сохраняет все настройки целиком. Неизвестный часовой пояс — `validation_failed`. */
@tag("Владелец")
@route("/api/owner/settings")
@put
@useAuth(SessionCookie)
op updateOwnerSettings(@body settings: OwnerSettings): OwnerSettings | ValidationProblem | Unauthenticated | Forbidden;

/** Новый Тип события. Id выдаёт сервер. */
model NewEventType {
  name: EventTypeName;
  description: EventTypeDescription;
  durationMinutes: EventDuration;
}

model EventTypeList {
  /** В порядке создания. */
  eventTypes: EventType[];
}

/** Типы событий текущего Владельца. Изменить и удалить тип нельзя. */
@tag("Владелец")
@route("/api/owner/event-types")
@get
@useAuth(SessionCookie)
op listEventTypes(): EventTypeList | Unauthenticated | Forbidden;

/** Создаёт Тип события. Длительность вне шага 30 минут — `validation_failed`. */
@tag("Владелец")
@route("/api/owner/event-types")
@post
@useAuth(SessionCookie)
op createEventType(@body draft: NewEventType):
  | {
      @statusCode statusCode: 201;
      @body eventType: EventType;
    }
  | ValidationProblem
  | Unauthenticated
  | Forbidden;

/** Бронирование в календаре Владельца. Видно только самому Владельцу. */
model Booking {
  id: Uuid;
  guest: Guest;

  /** Название Типа события на момент записи. */
  eventTypeName: EventTypeName;

  /** Начало Слота, UTC. */
  startAt: utcDateTime;

  createdAt: utcDateTime;
}

model BookingList {
  /** По возрастанию `startAt`. */
  bookings: Booking[];
}

/** Предстоящие Бронирования текущего Владельца: начало ещё не наступило. */
@tag("Владелец")
@route("/api/owner/bookings")
@get
@useAuth(SessionCookie)
op listUpcomingBookings(): BookingList | Unauthenticated | Forbidden;
