import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt } from "drizzle-orm";
import type { components } from "spec/api";

import { APP_OPTIONS, type AppOptions } from "../app-options.js";
import { AccountsService } from "../identity/accounts.service.js";
import { DATABASE, type Database } from "../platform/database/database.module.js";
import { bookings, calendars, eventTypes, users } from "../platform/database/schema.js";
import { problem } from "../platform/problem.js";

type Booking = components["schemas"]["Booking"];
type CurrentOwner = components["schemas"]["CurrentOwner"];

interface BookingRow {
  createdAt: Date;
  eventTypeName: string;
  guestEmail: string;
  guestName: string;
  id: string;
  startAt: Date;
}

const bookingFrom = (row: BookingRow): Booking => ({
  createdAt: row.createdAt.toISOString(),
  eventTypeName: row.eventTypeName,
  guest: { email: row.guestEmail, name: row.guestName },
  id: row.id,
  startAt: row.startAt.toISOString(),
});

/** The Владелец's upcoming Бронирования. Settings live in Планирование. */
@Injectable()
class OwnerService {
  public constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(APP_OPTIONS) private readonly options: AppOptions,
  ) {}

  /**
   * Бронирования whose start is still ahead, soonest first.
   * A start that has already come — including this exact instant — is no longer upcoming.
   * Another Владелец's rows never appear: the query is the session's own calendar.
   */
  public async listUpcoming(sessionId: string | undefined): Promise<Booking[]> {
    const ownerId = await this.ownerId(sessionId);
    const current = this.now();
    const rows = await this.db
      .select({
        createdAt: bookings.createdAt,
        eventTypeName: eventTypes.name,
        guestEmail: bookings.guestEmail,
        guestName: bookings.guestName,
        id: bookings.id,
        startAt: bookings.startAt,
      })
      .from(bookings)
      .innerJoin(calendars, eq(bookings.calendarId, calendars.id))
      .innerJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
      .where(and(eq(calendars.ownerId, ownerId), gt(bookings.startAt, current)))
      .orderBy(asc(bookings.startAt));
    return rows.map((row) => bookingFrom(row));
  }

  private now(): Date {
    const clock = this.options.now;
    if (clock === undefined) {
      return new Date();
    }
    return clock();
  }

  private async owner(sessionId: string | undefined): Promise<CurrentOwner> {
    const user = await this.accounts.currentUser(sessionId);
    if (user.role !== "owner") {
      throw problem(403, "forbidden");
    }
    return user;
  }

  private async ownerId(sessionId: string | undefined): Promise<string> {
    const owner = await this.owner(sessionId);
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, owner.email), eq(users.role, "owner")))
      .limit(1);
    if (row === undefined) {
      throw new Error("Owner is missing");
    }
    return row.id;
  }
}

export { OwnerService };
