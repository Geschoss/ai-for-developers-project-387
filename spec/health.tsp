import "@typespec/http";

using Http;

namespace CallCalendar;

model HealthStatus {
  status: "ok";
}

/** Приложение запущено и достучалось до базы. Его опрашивает health check при деплое. */
@tag("Служебное")
@route("/api/health")
@get
op getHealth(): HealthStatus;
