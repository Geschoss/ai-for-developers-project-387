import "@typespec/http";
import "@typespec/openapi";
import "./domain.tsp";
import "./errors.tsp";
import "./accounts.tsp";
import "./owner.tsp";
import "./calendars.tsp";
import "./admin.tsp";
import "./health.tsp";

using Http;
using OpenAPI;

/**
 * Календарь звонков: Гости бронируют Слоты выбранного Типа события в Календаре Владельца.
 *
 * Все ошибки — RFC 9457 (`application/problem+json`) с машиночитаемым `code`.
 */
@service(#{ title: "Календарь звонков" })
@info(#{ version: "0.1.0" })
namespace CallCalendar;

/** Серверная сессия. Cookie выставляют `registerOwner` и `logIn`. */
model SessionCookie is ApiKeyAuth<ApiKeyLocation.cookie, "sid">;
