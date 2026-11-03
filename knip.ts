import type { KnipConfig } from "knip";

// Generated files are not Knip sources.
// Declarations, OpenAPI and SQL stay out of the module graph.
const config: KnipConfig = {
  ignoreDependencies: [
    // Imported from spec/*.tsp and spec/tspconfig.yaml. Knip does not read TypeSpec.
    "@typespec/http",
    "@typespec/openapi",
    "@typespec/openapi3",
  ],
  workspaces: {
    frontend: {
      // Boundary fixtures exist to provoke dependency-cruiser. Nothing in the app imports them.
      ignore: ["src/**/__boundary-fixtures__/**"],
    },
  },
};

export default config;
