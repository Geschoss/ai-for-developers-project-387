/* oxlint-disable import/max-dependencies -- registration calls the Планирование port */
import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import type { components } from "spec/api";

import { DATABASE, type Database } from "../platform/database/database.module.js";
import { calendars, sessions, users } from "../platform/database/schema.js";
import { problem } from "../platform/problem.js";
import type { OpenCalendar } from "../scheduling/open-calendar.js";
import { knownCalendarSlug, knownTimeZone, rethrowConflict } from "./known-registration.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { sessionExpiresAt } from "./session-cookie.js";

type Credentials = components["schemas"]["Credentials"];
type CurrentOwner = components["schemas"]["CurrentOwner"];
type CurrentUser = components["schemas"]["CurrentUser"];
type OwnerRegistration = components["schemas"]["OwnerRegistration"];

const hashToCheck = async (
  user: { passwordHash: string } | undefined,
  dummyHash: Promise<string>,
): Promise<string> => {
  if (user === undefined) {
    const hash = await dummyHash;
    return hash;
  }
  return user.passwordHash;
};

interface StartedSession {
  sessionId: string;
  user: CurrentOwner;
}

interface UserRow {
  calendarSlug: string | null;
  email: string;
  name: string | null;
  role: "admin" | "owner";
  timeZone: string | null;
}

interface SessionRow extends UserRow {
  expiresAt: Date;
  id: string;
}

/** A Владелец behind a cookie. An Администратор has no Календарь, so the caller treats them as nobody. */
interface OwnerViewer {
  calendarSlug: string;
  id: string;
}

const currentUserFrom = (user: UserRow): CurrentUser => {
  if (user.role === "admin") {
    return { email: user.email, role: "admin" };
  }
  if (user.name === null || user.calendarSlug === null || user.timeZone === null) {
    throw new Error("Owner is missing calendar fields");
  }
  return {
    calendarSlug: user.calendarSlug,
    email: user.email,
    name: user.name,
    role: "owner",
    timeZone: user.timeZone,
  };
};

/** Registration, login, logout and the current user. Sessions live in `sessions`. */
@Injectable()
class AccountsService {
  /** Verified when the email is unknown, so login does not answer faster for a missing account. */
  private readonly dummyHash: Promise<string> = hashPassword(randomUUID());
  private calendarOpener?: OpenCalendar;

  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Планирование registers the port. Registration calls it inside the session transaction (ADR-0008). */
  public bindOpenCalendar(opener: OpenCalendar): void {
    this.calendarOpener = opener;
  }

  /** Creates an owner and a session. Email is stored in lowercase; the calendar slug is unique. */
  public async register(registration: OwnerRegistration): Promise<StartedSession> {
    knownTimeZone(registration.timeZone);
    knownCalendarSlug(registration.calendarSlug);
    const email = registration.email.toLowerCase();
    await this.rejectTaken(email, registration.calendarSlug);
    const userId = randomUUID();
    const sessionId = randomUUID();
    try {
      await this.storeOwner({ email, registration, sessionId, userId });
    } catch (error) {
      rethrowConflict(error);
    }
    return {
      sessionId,
      user: {
        calendarSlug: registration.calendarSlug,
        email,
        name: registration.name,
        role: "owner",
        timeZone: registration.timeZone,
      },
    };
  }

  /** Opens a session for an owner or an administrator. The error does not say which part was wrong. */
  public async logIn(credentials: Credentials): Promise<{ sessionId: string; user: CurrentUser }> {
    const email = credentials.email.toLowerCase();
    const [user] = await this.db
      .select({
        calendarSlug: calendars.slug,
        email: users.email,
        id: users.id,
        name: users.name,
        passwordHash: users.passwordHash,
        role: users.role,
        timeZone: calendars.timeZone,
      })
      .from(users)
      .leftJoin(calendars, eq(calendars.ownerId, users.id))
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    const passwordHash = await hashToCheck(user, this.dummyHash);
    const matches = await verifyPassword(passwordHash, credentials.password);
    if (user === undefined || !matches) {
      throw problem(401, "invalid_credentials");
    }
    const sessionId = randomUUID();
    await this.db.insert(sessions).values({
      expiresAt: sessionExpiresAt(),
      id: sessionId,
      userId: user.id,
    });
    return { sessionId, user: currentUserFrom(user) };
  }

  /** Deletes the session when there is one. Missing and unknown cookies are not an error. */
  public async logOut(sessionId: string | undefined): Promise<void> {
    if (sessionId === undefined) {
      return;
    }
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  public async findUser(sessionId: string | undefined): Promise<CurrentUser | undefined> {
    const row = await this.sessionRow(sessionId);
    if (row === undefined) {
      return undefined;
    }
    return currentUserFrom(row);
  }

  /**
   * The Владелец behind `sid`, or nobody. A missing session, an expired one and an Администратор are
   * nobody: booking them as a Гость must not look like their own Календарь.
   */
  public async findOwnerViewer(sessionId: string | undefined): Promise<OwnerViewer | undefined> {
    const row = await this.sessionRow(sessionId);
    if (row === undefined || row.role !== "owner" || row.calendarSlug === null) {
      return undefined;
    }
    return { calendarSlug: row.calendarSlug, id: row.id };
  }

  /** The Владелец behind `sid`. Missing sessions are `unauthenticated`; any other role is `forbidden`. */
  public async requireOwnerViewer(sessionId: string | undefined): Promise<OwnerViewer> {
    const row = await this.sessionRow(sessionId);
    if (row === undefined) {
      throw problem(401, "unauthenticated");
    }
    if (row.role !== "owner" || row.calendarSlug === null) {
      throw problem(403, "forbidden");
    }
    return { calendarSlug: row.calendarSlug, id: row.id };
  }

  /** The user behind `sid`, or `unauthenticated` when the session is missing or expired. */
  public async currentUser(sessionId: string | undefined): Promise<CurrentUser> {
    const user = await this.findUser(sessionId);
    if (user === undefined) {
      throw problem(401, "unauthenticated");
    }
    return user;
  }

  private async storeOwner(input: {
    email: string;
    registration: OwnerRegistration;
    sessionId: string;
    userId: string;
  }): Promise<void> {
    const passwordHash = await hashPassword(input.registration.password);
    const opener = this.opener();
    await this.db.transaction(async (tx) => {
      await tx.insert(users).values({
        email: input.email,
        id: input.userId,
        name: input.registration.name,
        passwordHash,
        role: "owner",
      });
      await opener.openCalendar(tx, {
        ownerId: input.userId,
        slug: input.registration.calendarSlug,
        timeZone: input.registration.timeZone,
      });
      await tx.insert(sessions).values({
        expiresAt: sessionExpiresAt(),
        id: input.sessionId,
        userId: input.userId,
      });
    });
  }

  private opener(): OpenCalendar {
    if (this.calendarOpener === undefined) {
      throw new Error("Планирование has not registered openCalendar");
    }
    return this.calendarOpener;
  }

  /**
   * The user behind `sid`. Missing and expired sessions are absent, not an error: a public route treats that
   * visitor as a Гость. An expired session is deleted.
   */
  private async sessionRow(sessionId: string | undefined): Promise<SessionRow | undefined> {
    if (sessionId === undefined) {
      return undefined;
    }
    const [row] = await this.db
      .select({
        calendarSlug: calendars.slug,
        email: users.email,
        expiresAt: sessions.expiresAt,
        id: users.id,
        name: users.name,
        role: users.role,
        timeZone: calendars.timeZone,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .leftJoin(calendars, eq(calendars.ownerId, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (row === undefined || row.expiresAt.getTime() <= Date.now()) {
      if (row !== undefined) {
        await this.db.delete(sessions).where(eq(sessions.id, sessionId));
      }
      return undefined;
    }
    return row;
  }

  /** Email wins when both are taken, so the form can point at one field. */
  private async rejectTaken(email: string, calendarSlug: string): Promise<void> {
    const [byEmail] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (byEmail !== undefined) {
      throw problem(409, "email_taken");
    }
    const [bySlug] = await this.db
      .select({ id: calendars.ownerId })
      .from(calendars)
      .where(eq(calendars.slug, calendarSlug))
      .limit(1);
    if (bySlug !== undefined) {
      throw problem(409, "slug_taken");
    }
  }
}

export { AccountsService };
