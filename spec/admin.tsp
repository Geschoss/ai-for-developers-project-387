import "@typespec/http";

using Http;

namespace CallCalendar;

/** Владелец в списке Администратора. */
model Owner {
  name: PersonName;
  email: Email;
  calendarSlug: CalendarSlug;
  timeZone: TimeZone;
  registeredAt: utcDateTime;
}

model OwnerList {
  /** По возрастанию `registeredAt`. Администратора в списке нет. */
  owners: Owner[];
}

/** Все Владельцы, только чтение. */
@tag("Администратор")
@route("/api/admin/owners")
@get
@useAuth(SessionCookie)
op listOwners(): OwnerList | Unauthenticated | Forbidden;
