import "@typespec/http";

using Http;

namespace CallCalendar;

/**
 * Ошибка в формате RFC 9457. Фронтенд переводит `code` в русский текст.
 */
@error
model Problem<Code extends string, Status extends int32> {
  @header contentType: "application/problem+json";
  @statusCode statusCode: Status;

  /** Машиночитаемый код ошибки. */
  code: Code;

  /** HTTP-статус, дублирует статус ответа (RFC 9457). */
  status: Status;

  /** Короткое описание для разработчика, не для показа пользователю. */
  title: string;

  detail?: string;
}

/** Одно нарушение схемы в теле, пути или параметрах запроса. */
model ValidationIssue {
  /** Где нарушение, например `/body/calendarSlug`. */
  path: string;

  message: string;
}

/** Запрос не прошёл проверку по схеме. */
@error
model ValidationProblem is Problem<"validation_failed", 400> {
  issues?: ValidationIssue[];
}

/** Нет сессии или она истекла. */
model Unauthenticated is Problem<"unauthenticated", 401>;

/** Сессия есть, но роль не подходит для операции. */
model Forbidden is Problem<"forbidden", 403>;

/** Неизвестный Адрес календаря. */
model CalendarNotFound is Problem<"calendar_not_found", 404>;

/** Id Типа события не принадлежит этому Календарю. */
model EventTypeNotFound is Problem<"event_type_not_found", 404>;
