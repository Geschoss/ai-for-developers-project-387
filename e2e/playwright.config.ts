import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3100";
/** The Администратор the app creates at startup. A throwaway account in a throwaway database. */
const admin = { email: "admin@example.com", password: "e2e-admin-password" };
const desktopChrome = devices["Desktop Chrome"];

const config = defineConfig({
  globalSetup: "./global-setup.ts",
  projects: [{ name: "chromium", use: { ...desktopChrome } }],
  testDir: "tests",
  // Starts Postgres and the built app (`pnpm e2e` builds it first).
  // GitHub Actions is set to UTC. The suite should register in that zone, not the developer's.
  use: { baseURL, timezoneId: "UTC", trace: "retain-on-failure" },
});

export { admin, baseURL };
export default config;
