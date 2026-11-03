import { describe, expect, it } from "vitest";

import { administrationImportsCalendar } from "../src/administration/__boundary-fixtures__/imports-calendar.js";
import { identityImportsSchedulingDomain } from "../src/identity/__boundary-fixtures__/imports-scheduling-domain.js";
import { identityImportsSchedulingScenario } from "../src/identity/__boundary-fixtures__/imports-scheduling-scenario.js";
import { forbiddenRuleNames } from "./cruise-boundaries.js";

const identityFixtures = [
  "backend/src/identity/__boundary-fixtures__/imports-scheduling-domain.ts",
  "backend/src/identity/__boundary-fixtures__/imports-scheduling-scenario.ts",
];

const administrationFixtures = [
  "backend/src/administration/__boundary-fixtures__/imports-calendar.ts",
];

describe("Идентификация и Администрирование", () => {
  it("keeps Идентификация off the Планирование core and the list of Владельцы off Календарь", async () => {
    expect(identityImportsSchedulingDomain).toBeTypeOf("function");
    expect(identityImportsSchedulingScenario).toBeTypeOf("function");
    expect(administrationImportsCalendar).toBeTypeOf("function");
    const names = await forbiddenRuleNames([...identityFixtures, ...administrationFixtures]);
    const identityViolations = names.filter((name) => name === "identity-has-no-scheduling-core");
    expect(identityViolations).toHaveLength(identityFixtures.length);
    expect(names).toContain("administration-does-not-load-calendar");
  });
});
