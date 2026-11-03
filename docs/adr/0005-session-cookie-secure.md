# Cookie сессии: `Secure` зависит от схемы запроса

Спека требует cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Браузер не сохраняет `Secure`-cookie по HTTP.
Локально приложение открыто по HTTP: `pnpm dev`, `docker compose` и Playwright. Если выставлять `Secure`
всегда, сессия в браузере не заведётся и регистрация с входом будут выглядеть сломанными.

`Secure` ставится, только когда запрос пришёл по HTTPS (`request.secure`). Приложение доверяет одному
прокси-хопу (`trust proxy`): на Render TLS заканчивается на прокси, и он передаёт `X-Forwarded-Proto: https`,
поэтому в проде cookie остаётся `Secure`. Прямой HTTP до прокси `Secure` не получает — так и задумано для
локальной разработки.

`HttpOnly` и `SameSite=Lax` стоят всегда. Срок сессии — 30 дней, и в БД, и в `Max-Age`.
