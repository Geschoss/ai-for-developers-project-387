import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import type { components } from "spec/api";

import { DATABASE, type Database } from "../platform/database/database.module.js";
import { calendars, users } from "../platform/database/schema.js";

type Owner = components["schemas"]["Owner"];

const ownerFrom = (row: {
  calendarSlug: string;
  createdAt: Date;
  email: string;
  name: string | null;
  timeZone: string;
}): Owner => {
  if (row.name === null) {
    throw new Error("Owner is missing a name");
  }
  return {
    calendarSlug: row.calendarSlug,
    email: row.email,
    name: row.name,
    registeredAt: row.createdAt.toISOString(),
    timeZone: row.timeZone,
  };
};

/** What the Администратор reads. Read-only: there are no actions on users. */
@Injectable()
class AdminService {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Every Владелец, oldest registration first. */
  public async listOwners(): Promise<Owner[]> {
    const rows = await this.db
      .select({
        calendarSlug: calendars.slug,
        createdAt: users.createdAt,
        email: users.email,
        name: users.name,
        timeZone: calendars.timeZone,
      })
      .from(users)
      .innerJoin(calendars, eq(calendars.ownerId, users.id))
      .where(eq(users.role, "owner"))
      .orderBy(asc(users.createdAt));
    return rows.map((row) => ownerFrom(row));
  }
}

export { AdminService };
