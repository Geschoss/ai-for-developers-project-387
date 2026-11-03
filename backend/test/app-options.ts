import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AppOptions } from "../src/app-options.js";

/** The Администратор every test app creates at startup. */
const testAdmin = { email: "admin@example.com", password: "admin-password" };

/** Options for an app on `databaseUrl` with a stub SPA whose `index.html` has the title `SPA`. */
const testAppOptions = (databaseUrl: string, overrides: Partial<AppOptions> = {}): AppOptions => {
  const spaDir = mkdtempSync(join(tmpdir(), "spa-"));
  writeFileSync(join(spaDir, "index.html"), "<!doctype html><title>SPA</title>");
  return { admin: testAdmin, databaseUrl, spaDir, ...overrides };
};

export { testAdmin, testAppOptions };
