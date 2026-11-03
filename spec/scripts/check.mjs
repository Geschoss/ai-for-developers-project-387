// Fails when the committed openapi.yaml or api.d.ts differ from a fresh TypeSpec compile. CI will run it (ADR-0001).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outDir = mkdtempSync(join(tmpdir(), "openapi-check-"));
try {
  execFileSync(
    "tsp",
    ["compile", "main.tsp", "--option", `@typespec/openapi3.emitter-output-dir=${outDir}`],
    {
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  execFileSync(
    "openapi-typescript",
    [join(outDir, "openapi.yaml"), "-o", join(outDir, "api.d.ts")],
    {
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  const stale = ["openapi.yaml", "api.d.ts"].filter(
    (file) => readFileSync(join(outDir, file), "utf8") !== readFileSync(file, "utf8"),
  );
  if (stale.length > 0) {
    // oxlint-disable-next-line eslint/no-console -- this script's output is the failure message
    console.error(
      `spec/${stale.join(", spec/")} out of date with the TypeSpec sources. Run \`pnpm spec:build\` and commit.`,
    );
    // oxlint-disable-next-line unicorn/no-process-exit -- a non-zero exit is how CI sees the failure
    process.exit(1);
  }
  // oxlint-disable-next-line eslint/no-console -- this script's output is the success message
  console.log("spec/openapi.yaml and spec/api.d.ts are up to date.");
} finally {
  rmSync(outDir, { force: true, recursive: true });
}
