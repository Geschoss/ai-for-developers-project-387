namespace CallCalendar;

/** Адрес календаря: уникальное короткое имя Владельца, из него строится публичная ссылка. */
@minLength(3)
@maxLength(30)
@pattern("^[a-z0-9-]+$")
scalar CalendarSlug extends string;

/** Часовой пояс из базы IANA, например `Europe/Moscow`. Существование пояса проверяет сервер. */
@minLength(1)
@maxLength(64)
@pattern("^[A-Za-z0-9_+\\-/]+$")
scalar TimeZone extends string;

/** Горизонт планирования: на сколько дней вперёд, включая сегодня, можно бронировать Слоты. */
@minValue(1)
@maxValue(60)
scalar PlanningHorizon extends int32;

/** Лимит бронирований: сколько Бронирований один email может сделать у Владельца за день. */
@minValue(1)
@maxValue(18)
scalar DailyBookingLimit extends int32;

/** Название Типа события. */
@minLength(1)
@maxLength(100)
scalar EventTypeName extends string;

/** Описание Типа события. */
@minLength(1)
@maxLength(1000)
scalar EventTypeDescription extends string;

/**
 * Длительность Типа события в минутах.
 * От 30 до 540 включительно, шаг 30: Слот должен целиком уложиться в 09:00–18:00.
 */
enum EventDuration {
  m30: 30,
  m60: 60,
  m90: 90,
  m120: 120,
  m150: 150,
  m180: 180,
  m210: 210,
  m240: 240,
  m270: 270,
  m300: 300,
  m330: 330,
  m360: 360,
  m390: 390,
  m420: 420,
  m450: 450,
  m480: 480,
  m510: 510,
  m540: 540,
}

@format("email")
@maxLength(254)
scalar Email extends string;

/** Имя человека, как он его ввёл. */
@minLength(1)
@maxLength(100)
scalar PersonName extends string;

// @minLength(8) — проверка длины пароля временно выключена
@maxLength(128)
scalar Password extends string;

@format("uuid")
scalar Uuid extends string;
