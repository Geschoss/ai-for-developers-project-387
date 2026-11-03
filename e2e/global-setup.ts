import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";

import { admin, baseURL } from "./playwright.config.ts";

// oxlint-disable-next-line eslint/no-magic-numbers -- poll for at most 30s while the built app boots
const healthTimeoutMs = 30_000;
// oxlint-disable-next-line eslint/no-magic-numbers -- pause between health checks
const healthPollMs = 250;

const waitForHealth = async (url: string): Promise<void> => {
  const deadline = Date.now() + healthTimeoutMs;
  while (Date.now() < deadline) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- poll until the app listens; the waits are sequential
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- poll until the app listens; the waits are sequential
    await delay(healthPollMs);
  }
  throw new Error(`${url} did not become healthy`);
};

/** Runs the production build of the app against a throwaway Postgres; the returned function stops both. */
const globalSetup = async (): Promise<() => Promise<void>> => {
  const database = await new PostgreSqlContainer("postgres:18-alpine").start();
  const app = spawn("node", [fileURLToPath(new URL("../backend/dist/main.js", import.meta.url))], {
    env: {
      ...process.env,
      ADMIN_EMAIL: admin.email,
      ADMIN_PASSWORD: admin.password,
      DATABASE_URL: database.getConnectionUri(),
      PORT: new URL(baseURL).port,
    },
    stdio: "inherit",
  });
  await waitForHealth(`${baseURL}/api/health`);

  return async (): Promise<void> => {
    app.kill();
    await database.stop();
  };
};

export default globalSetup;
