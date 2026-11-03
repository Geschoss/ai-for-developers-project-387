import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { APP_OPTIONS, type AppOptions } from "../app-options.js";
import { DATABASE, type Database } from "../platform/database/database.module.js";
import { users } from "../platform/database/schema.js";
import { registrationConflict } from "./known-registration.js";
import { hashPassword } from "./passwords.js";

/**
 * Creates the Администратор from {@link AppOptions.admin} once migrations have run. Nothing happens when one already
 * exists, even under another email: there is a single Администратор, and `users_single_admin` guards it.
 */
@Injectable()
class AdminSeed implements OnApplicationBootstrap {
  public constructor(
    @Inject(APP_OPTIONS) private readonly options: AppOptions,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    if (await this.adminExists()) {
      return;
    }
    const email = this.options.admin.email.toLowerCase();
    if (await this.ownerHasEmail(email)) {
      throw new Error(`ADMIN_EMAIL ${email} already belongs to an owner`);
    }
    await this.insertAdmin(email);
  }

  private async insertAdmin(email: string): Promise<void> {
    const passwordHash = await hashPassword(this.options.admin.password);
    try {
      // Another instance starting at the same time may win; `users_single_admin` keeps it to one.
      await this.db
        .insert(users)
        .values({ email, id: randomUUID(), passwordHash, role: "admin" })
        .onConflictDoNothing({ target: users.role, where: sql`${users.role} = 'admin'` });
    } catch (error) {
      // The winner's row also takes the email, and that index is not the conflict target.
      // That row is not a Владелец, so startup goes on. An owner who took the email meanwhile still fails it.
      if (registrationConflict(error) === "email_taken" && (await this.adminExists())) {
        return;
      }
      throw error;
    }
  }

  private async ownerHasEmail(email: string): Promise<boolean> {
    const [owner] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email}`, eq(users.role, "owner")))
      .limit(1);
    return owner !== undefined;
  }

  private async adminExists(): Promise<boolean> {
    const [admin] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    return admin !== undefined;
  }
}

export { AdminSeed };
