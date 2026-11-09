import "@typespec/http";

using Http;

namespace CallCalendar;

/** Тип события, который Гость выбирает перед Слотами. */
model EventType {
  id: Uuid;
  name: EventTypeName;
  description: EventTypeDescription;

  /** Длительность Слота этого типа, в минутах. */
  durationMinutes: EventDuration;
}

/** Публичные данные календаря. Данных Гостей здесь нет. */
model PublicCalendar {
  ownerName: PersonName;
  timeZone: TimeZone;
  planningHorizonDays: PlanningHorizon;

  /** В порядке создания. Пустой список — бронь не принимается. */
  eventTypes: EventType[];
}

enum SlotStatus {
  free,
  booked,
}

/** Слот выбранного Типа события. Для Гостя он только «свободно» или «занято»: кто его занял, не раскрывается. */
model Slot {
  /** Начало Слота, UTC. */
  startAt: utcDateTime;

  status: SlotStatus;
}

model SlotList {
  /** По возрастанию `startAt`. */
  slots: Slot[];
}

/** Гость: бронирует без аккаунта, по имени и email. */
model Guest {
  name: PersonName;
  email: Email;
}

model BookingRequest {
  /** Начало Слота, UTC. Должно совпадать с началом Слота выбранного типа. */
  startAt: utcDateTime;

  /** Тип события этого Календаря. Чужой id — `event_type_not_found`. */
  eventTypeId: Uuid;

  guest: Guest;

  /** Необязательная Заметка к Бронированию. Обрезается по краям, пустая становится `null`, значение длиннее 500 символов после обрезки отклоняется. */
  note?: string | null;
}

/** Всё, что нужно экрану «Вы записаны». */
model BookingConfirmation {
  ownerName: PersonName;

  /** Начало Слота, UTC. */
  startAt: utcDateTime;

  /** Пояс Владельца: экран показывает время и в нём, и в поясе Гостя. */
  ownerTimeZone: TimeZone;

  /** Заметка к Бронированию, `null` если Гость её не оставил. */
  note: string | null;
}

/** Слот занят другим Гостем или email исчерпал Лимит бронирований на этот день у этого Владельца. */
model BookingConflict is Problem<"slot_taken" | "daily_limit_reached", 409>;

/**
 * Бронирование нарушает правила календаря:
 * `not_a_slot_start` — момент не совпадает с началом Слота сетки;
 * `slot_in_past` — Слот уже начался или прошёл;
 * `outside_planning_horizon` — Слот за Горизонтом планирования;
 * `own_calendar` — залогиненный Владелец бронирует собственный календарь.
 */
model BookingRejected is Problem<"not_a_slot_start" | "slot_in_past" | "outside_planning_horizon" | "own_calendar", 422>;

/** Публичная информация о календаре по Адресу календаря. */
@tag("Публичный календарь")
@route("/api/calendars/{calendarSlug}")
@get
op getPublicCalendar(@path calendarSlug: CalendarSlug): PublicCalendar | ValidationProblem | CalendarNotFound;

/**
 * Слоты, которые начинаются в полуинтервале [`from`, `to`). Возвращаются только Слоты, доступные для бронирования
 * по времени: уже начавшиеся и лежащие за Горизонтом планирования не попадают в список.
 */
@tag("Публичный календарь")
@route("/api/calendars/{calendarSlug}/slots")
@get
op listSlots(
  @path calendarSlug: CalendarSlug,
  @query from: utcDateTime,
  @query to: utcDateTime,
  @query eventTypeId: Uuid,
): SlotList | ValidationProblem | CalendarNotFound | EventTypeNotFound;

/**
 * Гость бронирует Слот. Сессия не нужна; если она есть, сервер по ней отклоняет бронирование собственного
 * календаря (`own_calendar`), а на чужом календаре залогиненный пользователь бронирует как обычный Гость.
 */
@tag("Публичный календарь")
@route("/api/calendars/{calendarSlug}/bookings")
@post
@useAuth(NoAuth | SessionCookie)
op createBooking(@path calendarSlug: CalendarSlug, @body booking: BookingRequest):
  | {
      @statusCode statusCode: 201;
      @body confirmation: BookingConfirmation;
    }
  | ValidationProblem
  | CalendarNotFound
  | EventTypeNotFound
  | BookingConflict
  | BookingRejected;
