import { Module } from "@nestjs/common";

interface AppOptions {
  /** Администратор to create at startup when the database has none. From `ADMIN_EMAIL` / `ADMIN_PASSWORD`. */
  admin: { email: string; password: string };
  databaseUrl: string;
  /**
   * Clock for «today» and for whether a Слот has started. Production omits it and the app uses the real time.
   * Tests pass a function so the Горизонт планирования and `slot_in_past` do not depend on the wall clock.
   */
  now?: () => Date;
  /** Directory with the built SPA; its `index.html` answers every non-API GET. */
  spaDir: string;
}

/** Injection token for {@link AppOptions}. */
const APP_OPTIONS = Symbol("APP_OPTIONS");

/** Nest module identity for the {@link AppOptions} provider. */
@Module({})
class AppOptionsModule {}

export { APP_OPTIONS, AppOptionsModule, type AppOptions };
