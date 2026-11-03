import createClient from "openapi-fetch";

/** Proves a second API client is rejected. The browser uses shared/api.ts (ADR-0007). */
const secondClient = createClient;

export { secondClient };
