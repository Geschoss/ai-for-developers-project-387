import type { Request } from "express";

/**
 * How long a session stays valid. Cookie `Max-Age` and `sessions.expires_at` share it.
 * 30 days is long enough for a calendar the owner returns to, short of a permanent token.
 */
// oxlint-disable-next-line eslint/no-magic-numbers -- 30 days, in seconds
const sessionTtlSeconds = 2_592_000;

// oxlint-disable-next-line eslint/no-magic-numbers -- seconds to milliseconds
const millisecondsPerSecond = 1000;

const sessionExpiresAt = (): Date =>
  new Date(Date.now() + sessionTtlSeconds * millisecondsPerSecond);

/**
 * `Secure` follows the request scheme. See ADR-0005: local HTTP must be able to store the cookie,
 * and HTTPS (including a proxy that sets `X-Forwarded-Proto`) must mark it Secure.
 */
const sessionCookie = (sessionId: string, secure: boolean): string => {
  const parts = [
    `sid=${sessionId}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${sessionTtlSeconds}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
};

/** Expires the cookie. Sent on logout, including when there was no session. */
const clearedSessionCookie = (secure: boolean): string => {
  const parts = ["sid=", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);

/** The `sid` cookie, when it is a UUID. Anything else is not a session. */
const sessionIdFrom = (request: Request): string | undefined => {
  const { cookies } = request;
  if (typeof cookies !== "object") {
    return undefined;
  }
  const sid: unknown = cookies["sid"];
  if (typeof sid !== "string" || !isUuid(sid)) {
    return undefined;
  }
  return sid;
};

export { clearedSessionCookie, sessionCookie, sessionExpiresAt, sessionIdFrom };
