import "@typespec/http";

using Http;

namespace CallCalendar;

model OwnerRegistration {
  name: PersonName;

  /** Уникален без учёта регистра. */
  email: Email;

  password: Password;

  /** Уникален. */
  calendarSlug: CalendarSlug;

  timeZone: TimeZone;
}

model Credentials {
  email: Email;

  /** Минимальную длину не проверяем: на неверный пароль любой длины ответ один — `invalid_credentials`. */
  @maxLength(128)
  password: string;
}

/** Залогиненный Владелец. */
model CurrentOwner {
  role: "owner";
  name: PersonName;
  email: Email;
  calendarSlug: CalendarSlug;
  timeZone: TimeZone;
}

/** Залогиненный Администратор. Календаря у него нет. */
model CurrentAdmin {
  role: "admin";
  email: Email;
}

@discriminated(#{ envelope: "none", discriminatorPropertyName: "role" })
union CurrentUser {
  owner: CurrentOwner,
  admin: CurrentAdmin,
}

/** Ответ, который открывает сессию: cookie `sid` в `Set-Cookie`. */
model SessionStarted<User, Status extends int32> {
  @statusCode statusCode: Status;
  @header("Set-Cookie") setCookie: string;
  @body user: User;
}

/** Email или Адрес календаря уже заняты. */
model RegistrationConflict is Problem<"email_taken" | "slug_taken", 409>;

/** Неверная пара email и пароль. Не уточняет, что именно неверно. */
model InvalidCredentials is Problem<"invalid_credentials", 401>;

/**
 * Регистрация Владельца. Новый Владелец сразу залогинен; Горизонт планирования 14, Лимит бронирований 2.
 * Неизвестный часовой пояс — `validation_failed`.
 */
@tag("Аккаунты")
@route("/api/auth/register")
@post
op registerOwner(@body registration: OwnerRegistration):
  | SessionStarted<CurrentOwner, 201>
  | ValidationProblem
  | RegistrationConflict;

/** Вход Владельца или Администратора. */
@tag("Аккаунты")
@route("/api/auth/login")
@post
op logIn(@body credentials: Credentials): SessionStarted<CurrentUser, 200> | ValidationProblem | InvalidCredentials;

/** Выход: удаляет сессию и cookie. Без сессии тоже отвечает 204. */
@tag("Аккаунты")
@route("/api/auth/logout")
@post
op logOut(): {
  @statusCode statusCode: 204;
  @header("Set-Cookie") setCookie: string;
};

/** Текущий пользователь и его роль. */
@tag("Аккаунты")
@route("/api/auth/me")
@get
@useAuth(SessionCookie)
op getCurrentUser(): CurrentUser | Unauthenticated;
