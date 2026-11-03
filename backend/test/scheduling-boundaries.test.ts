import { describe, expect, it } from "vitest";

import { applicationImportsInfrastructure } from "../src/scheduling/application/__boundary-fixtures__/imports-infrastructure.js";
import { domainImportsNest } from "../src/scheduling/domain/__boundary-fixtures__/imports-nestjs.js";
import { httpImportsInfrastructure } from "../src/scheduling/http/__boundary-fixtures__/imports-infrastructure.js";
import { forbiddenRuleNames } from "./cruise-boundaries.js";

const schedulingFixtures = [
  "backend/src/scheduling/domain/__boundary-fixtures__/imports-nestjs.ts",
  "backend/src/scheduling/application/__boundary-fixtures__/imports-infrastructure.ts",
  "backend/src/scheduling/http/__boundary-fixtures__/imports-infrastructure.ts",
];

describe("Планирование boundaries", () => {
  it("rejects Nest in the domain, an adapter in a scenario, and infrastructure outside the module", async () => {
    expect(domainImportsNest).toBeTypeOf("function");
    expect(applicationImportsInfrastructure).toBeTypeOf("function");
    expect(httpImportsInfrastructure).toBeTypeOf("function");
    const names = await forbiddenRuleNames(schedulingFixtures);
    expect(names).toEqual(
      expect.arrayContaining([
        "scheduling-domain-is-pure",
        "scheduling-application-has-no-adapters",
        "scheduling-infrastructure-only-from-module",
      ]),
    );
  });
});
