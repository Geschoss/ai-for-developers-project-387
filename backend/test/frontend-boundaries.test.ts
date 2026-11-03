import { describe, expect, it } from "vitest";

import { forbiddenRuleNames } from "./cruise-boundaries.js";

const frontendFixtures = [
  "frontend/src/scheduling/__boundary-fixtures__/imports-identity.ts",
  "frontend/src/identity/__boundary-fixtures__/imports-administration.ts",
  "frontend/src/administration/__boundary-fixtures__/imports-scheduling.ts",
  "frontend/src/scheduling/__boundary-fixtures__/imports-routes.ts",
  "frontend/src/scheduling/model/__boundary-fixtures__/imports-booking.ts",
  "frontend/src/scheduling/api/__boundary-fixtures__/second-client.ts",
  "frontend/src/shared/__boundary-fixtures__/imports-screen.ts",
];

describe("frontend contexts", () => {
  it("keeps contexts apart, the presentation model off the booking call, and a single API client", async () => {
    const names = await forbiddenRuleNames(frontendFixtures);
    expect(names).toEqual(
      expect.arrayContaining([
        "frontend-scheduling-stays-apart",
        "frontend-identity-stays-apart",
        "frontend-administration-stays-apart",
        "frontend-screens-read-session-from-app",
        "scheduling-model-is-presentation",
        "frontend-one-api-client",
        "frontend-shared-stays-under-screens",
      ]),
    );
  });
});
