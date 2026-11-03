import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

const databaseUrl = requiredEnv("DATABASE_URL");
// The Администратор always exists, so the app does not start without their credentials.
const admin = { email: requiredEnv("ADMIN_EMAIL"), password: requiredEnv("ADMIN_PASSWORD") };

const spaDir =
  process.env["SPA_DIR"] ?? fileURLToPath(new URL("../../frontend/dist", import.meta.url));
const port = process.env["PORT"];

const app = await createApp({ admin, databaseUrl, spaDir });
app.enableShutdownHooks();
await app.listen(Number(port ?? 3000), "0.0.0.0");
