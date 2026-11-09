import { defineConfig, devices, type ReporterDescription } from "@playwright/test";

const baseURL = "http://localhost:3100";
/** The Администратор the app creates at startup. A throwaway account in a throwaway database. */
const admin = { email: "admin@example.com", password: "e2e-admin-password" };
const desktopChrome = devices["Desktop Chrome"];

// E2E_TRACE=on (the verify-head job of ci.yml) keeps a trace of every test, passed ones too, as evidence for the PR head.
// E2E_REPORT=<file> also writes the JSON report there.
const traceMode =
  { on: "on" as const }[process.env["E2E_TRACE"] ?? ""] ?? ("retain-on-failure" as const);
const reportFile = process.env["E2E_REPORT"] ?? "";
const reporters: ReporterDescription[] = [["list"]];
if (reportFile !== "") {
  reporters.push(["json", { outputFile: reportFile }]);
}

const config = defineConfig({
  globalSetup: "./global-setup.ts",
  projects: [{ name: "chromium", use: { ...desktopChrome } }],
  reporter: reporters,
  testDir: "tests",
  // Starts Postgres and the built app (`pnpm e2e` builds it first).
  // GitHub Actions is set to UTC. The suite should register in that zone, not the developer's.
  use: { baseURL, timezoneId: "UTC", trace: traceMode },
});

export { admin, baseURL };
export default config;
