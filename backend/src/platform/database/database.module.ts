import { fileURLToPath } from "node:url";

import { type OnApplicationShutdown, type OnModuleInit, Inject, Module } from "@nestjs/common";
import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { APP_OPTIONS, type AppOptions } from "../../app-options.js";
// oxlint-disable-next-line import/no-namespace -- Drizzle's relational client takes the schema module namespace
import * as schema from "./schema.js";

type Database = NodePgDatabase<typeof schema>;

/** Injection token for the Drizzle instance. */
const DATABASE = Symbol("DATABASE");

const POOL = Symbol("POOL");

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));

const createPool = (options: AppOptions): Pool =>
  new Pool({ connectionString: options.databaseUrl });

const createDatabase = (pool: Pool): Database => drizzle(pool, { schema });

@Module({
  exports: [DATABASE],
  providers: [
    {
      inject: [APP_OPTIONS],
      provide: POOL,
      useFactory: createPool,
    },
    {
      inject: [POOL],
      provide: DATABASE,
      useFactory: createDatabase,
    },
  ],
})
class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
  public constructor(
    @Inject(POOL) private readonly pool: Pool,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** Brings the schema up to date before the app takes requests. */
  public async onModuleInit(): Promise<void> {
    await migrate(this.db, { migrationsFolder });
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

export { DATABASE, DatabaseModule, type Database };
