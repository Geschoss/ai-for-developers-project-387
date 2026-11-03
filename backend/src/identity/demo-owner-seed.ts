import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DATABASE, type Database } from "../platform/database/database.module.js";
import { calendars, users } from "../platform/database/schema.js";
import type { OpenCalendar } from "../scheduling/open-calendar.js";
import type { OpenEventType } from "../scheduling/open-event-type.js";
import { registrationConflict } from "./known-registration.js";
import { hashPassword } from "./passwords.js";

const demoEmail = "demo@example.com";
const demoPassword = "demo-owner-1";
const demoName = "Демо";
const demoSlug = "demo";
const demoTimeZone = "Europe/Moscow";
const demoEventName = "Звонок";
const demoEventDescription = "Короткий созвон на 30 минут";
// oxlint-disable-next-line eslint/no-magic-numbers -- the demo Тип события lasts 30 minutes
const demoDurationMinutes = 30;

interface DemoPorts {
  calendar: OpenCalendar;
  eventType: OpenEventType;
}

/**
 * Creates the demo Владелец once, beside the Администратор. A taken email or Адрес календаря is left
 * alone: startup still succeeds, and an existing account is not overwritten.
 */
@Injectable()
class DemoOwnerSeed implements OnApplicationBootstrap {
  private ports?: DemoPorts;

  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Планирование registers the ports. The seed runs after that, on application bootstrap. */
  public bind(ports: DemoPorts): void {
    this.ports = ports;
  }

  public async onApplicationBootstrap(): Promise<void> {
    if (await this.alreadyTaken()) {
      return;
    }
    const ports = this.bound();
    const ownerId = randomUUID();
    const passwordHash = await hashPassword(demoPassword);
    try {
      await this.store(ports, ownerId, passwordHash);
    } catch (error) {
      // Two instances can pass the check together. The unique indexes keep a single account.
      if (registrationConflict(error) !== undefined) {
        return;
      }
      throw error;
    }
  }

  private bound(): DemoPorts {
    if (this.ports === undefined) {
      throw new Error("Планирование has not registered the demo Владелец ports");
    }
    return this.ports;
  }

  /** Email and Адрес are both reserved. Either one already stored means this seed does nothing. */
  private async alreadyTaken(): Promise<boolean> {
    const [byEmail] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${demoEmail}`)
      .limit(1);
    if (byEmail !== undefined) {
      return true;
    }
    const [bySlug] = await this.db
      .select({ id: calendars.ownerId })
      .from(calendars)
      .where(eq(calendars.slug, demoSlug))
      .limit(1);
    return bySlug !== undefined;
  }

  private async store(ports: DemoPorts, ownerId: string, passwordHash: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(users).values({
        email: demoEmail,
        id: ownerId,
        name: demoName,
        passwordHash,
        role: "owner",
      });
      await ports.calendar.openCalendar(tx, {
        ownerId,
        slug: demoSlug,
        timeZone: demoTimeZone,
      });
      await ports.eventType.openEventType(tx, {
        description: demoEventDescription,
        durationMinutes: demoDurationMinutes,
        name: demoEventName,
        ownerId,
      });
    });
  }
}

export { DemoOwnerSeed };
