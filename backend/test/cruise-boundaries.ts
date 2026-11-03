import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// oxlint-disable-next-line typescript/strict-void-return -- execFile both returns a ChildProcess and takes a callback
const run = promisify(execFile);
const repoRoot = join(import.meta.dirname, "../..");

interface CruiseOutput {
  stdout: string;
}

const isCruiseOutput = (error: unknown): error is CruiseOutput =>
  typeof error === "object" &&
  error !== null &&
  "stdout" in error &&
  typeof error.stdout === "string";

interface Violation {
  rule: { name: string } | undefined;
}

interface CruiseReport {
  summary: { violations: Violation[] } | undefined;
}

const isCruiseReport = (value: unknown): value is CruiseReport =>
  typeof value === "object" && value !== null && "summary" in value;

const provingConfig = (): string => {
  const source = readFileSync(join(repoRoot, "dependency-cruiser.config.js"), "utf8");
  const proving = source.replace(', "boundary-fixtures"', "");
  if (proving === source) {
    throw new Error("boundary-fixtures exclude was not found");
  }
  const directory = mkdtempSync(join(tmpdir(), "depcruise-"));
  const config = join(directory, "proving.config.mjs");
  writeFileSync(config, proving);
  return config;
};

const cruiseStdout = async (fixtures: string[]): Promise<string> => {
  const binary = join(repoRoot, "node_modules/.bin/depcruise");
  const args = ["--config", provingConfig(), "--output-type", "json", ...fixtures];
  try {
    const result = await run(binary, args, { cwd: repoRoot, encoding: "utf8" });
    return result.stdout;
  } catch (error) {
    if (!isCruiseOutput(error)) {
      throw error;
    }
    return error.stdout;
  }
};

/** Rule names dependency-cruiser reports for `fixtures` once boundary fixtures are visible. */
const forbiddenRuleNames = async (fixtures: string[]): Promise<string[]> => {
  const parsed: unknown = JSON.parse(await cruiseStdout(fixtures));
  if (!isCruiseReport(parsed) || parsed.summary === undefined) {
    throw new Error("dependency-cruiser did not return violations");
  }
  const names: string[] = [];
  for (const violation of parsed.summary.violations) {
    if (violation.rule !== undefined) {
      names.push(violation.rule.name);
    }
  }
  return names;
};

export { forbiddenRuleNames };
