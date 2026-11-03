import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { components } from "spec/api";

import { DATABASE, type Database } from "./database/database.module.js";

@Controller("health")
export class HealthController {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  public async getHealth(): Promise<components["schemas"]["HealthStatus"]> {
    await this.db.execute(sql`select 1`);
    return { status: "ok" };
  }
}
