/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  forbidden: [
    {
      comment: "Cycles are forbidden.",
      from: {},
      name: "no-circular",
      severity: "error",
      to: { circular: true },
    },
    {
      comment:
        "The frontend does not import the backend. The only shared code is the generated contract in spec/.",
      from: { path: "^frontend/" },
      name: "no-frontend-to-backend",
      severity: "error",
      to: { path: "^backend/" },
    },
    {
      comment:
        "The backend does not import the frontend. The only shared code is the generated contract in spec/.",
      from: { path: "^backend/" },
      name: "no-backend-to-frontend",
      severity: "error",
      to: { path: "^frontend/" },
    },
    {
      comment:
        "Frontend and backend may import from spec/ only the generated contract (spec/api.d.ts and spec/openapi.yaml).",
      from: { path: "^(frontend|backend)/" },
      name: "apps-only-generated-spec",
      severity: "error",
      to: {
        path: "^spec/",
        pathNot: String.raw`^spec/(api\.d\.ts|openapi\.yaml)$`,
      },
    },
    {
      comment:
        "Production code does not import devDependencies. Type-only imports are erased and do not count.",
      from: {
        path: "^(frontend/src|backend/src)/",
        pathNot: String.raw`\.(?:spec|test)\.(?:ts|tsx)$|^frontend/src/test-setup\.ts$`,
      },
      name: "not-to-dev-dep",
      severity: "error",
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: ["node_modules/@types/"],
      },
    },
    {
      comment:
        "The Планирование domain does not import Nest, Drizzle, Express, infrastructure, or HTTP (ADR-0006).",
      from: { path: "^backend/src/scheduling/domain/" },
      name: "scheduling-domain-is-pure",
      severity: "error",
      to: {
        path: "node_modules/(?:@nestjs/|drizzle-orm/|express/)|^backend/src/scheduling/(?:infrastructure|http)/",
      },
    },
    {
      comment: "Сценарии depend on ports, not on Drizzle adapters or HTTP (ADR-0006).",
      from: { path: "^backend/src/scheduling/application/" },
      name: "scheduling-application-has-no-adapters",
      severity: "error",
      to: { path: "^backend/src/scheduling/(?:infrastructure|http)/" },
    },
    {
      comment: "Drizzle adapters are wired in the Планирование module and nowhere else (ADR-0006).",
      from: {
        path: "^backend/",
        pathNot: String.raw`^backend/src/scheduling/(?:scheduling\.module\.ts|infrastructure/)`,
      },
      name: "scheduling-infrastructure-only-from-module",
      severity: "error",
      to: { path: "^backend/src/scheduling/infrastructure/" },
    },
    {
      comment:
        "Идентификация stays a thin module: it does not import the Планирование domain or scenarios.",
      from: { path: "^backend/src/identity/" },
      name: "identity-has-no-scheduling-core",
      severity: "error",
      to: { path: "^backend/src/scheduling/(?:domain|application)/" },
    },
    {
      comment:
        "Администрирование lists Владельцы from the row. It does not load the Календарь aggregate.",
      from: { path: "^backend/src/administration/" },
      name: "administration-does-not-load-calendar",
      severity: "error",
      to: { path: "^backend/src/scheduling/domain/" },
    },
    {
      comment: "Frontend contexts stay apart. The frame in app/ composes their pages (ADR-0007).",
      from: { path: "^frontend/src/scheduling/" },
      name: "frontend-scheduling-stays-apart",
      severity: "error",
      to: { path: "^frontend/src/(?:identity|administration)/" },
    },
    {
      comment: "Frontend contexts stay apart. The frame in app/ composes their pages (ADR-0007).",
      from: { path: "^frontend/src/identity/" },
      name: "frontend-identity-stays-apart",
      severity: "error",
      to: { path: "^frontend/src/(?:scheduling|administration)/" },
    },
    {
      comment: "Frontend contexts stay apart. The frame in app/ composes their pages (ADR-0007).",
      from: { path: "^frontend/src/administration/" },
      name: "frontend-administration-stays-apart",
      severity: "error",
      to: { path: "^frontend/src/(?:scheduling|identity)/" },
    },
    {
      comment:
        "A screen reads the session from app/session.tsx. Importing the rest of app/ cycles back into the routes (ADR-0007).",
      from: {
        path: "^frontend/src/(?:scheduling|identity|administration)/",
        pathNot: String.raw`\.(?:spec|test)\.(?:ts|tsx)$`,
      },
      name: "frontend-screens-read-session-from-app",
      severity: "error",
      to: {
        path: "^frontend/src/app/",
        pathNot: String.raw`^frontend/src/app/session\.tsx$`,
      },
    },
    {
      comment:
        "scheduling/model only presents Слоты. The booking call lives in scheduling/api (ADR-0007).",
      from: { path: "^frontend/src/scheduling/model/" },
      name: "scheduling-model-is-presentation",
      severity: "error",
      to: { path: String.raw`^frontend/src/(?:shared/api\.ts|scheduling/api/)` },
    },
    {
      comment: "The browser has one API client, frontend/src/shared/api.ts (ADR-0007).",
      from: {
        path: "^frontend/",
        pathNot: String.raw`^frontend/src/shared/api\.ts$`,
      },
      name: "frontend-one-api-client",
      severity: "error",
      to: { path: "node_modules/openapi-fetch/" },
    },
    {
      comment:
        "shared/ sits under the screens: the client, error texts, and pieces every context uses (ADR-0007).",
      from: { path: "^frontend/src/shared/" },
      name: "frontend-shared-stays-under-screens",
      severity: "error",
      to: { path: "^frontend/src/(?:app|scheduling|identity|administration)/" },
    },
    // No-orphans is intentionally absent: unused files are Knip's job.
  ],
  options: {
    combinedDependencies: true,
    doNotFollow: {
      path: ["node_modules", String.raw`^spec/openapi\.yaml$`, String.raw`^spec/api\.d\.ts$`],
    },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default", "types"],
      exportsFields: ["exports"],
      mainFields: ["module", "main"],
    },
    exclude: {
      // Package builds only. A bare `dist/` would also hide dependencies that resolve into
      // `node_modules/**/dist`, so the single API client would be invisible (ADR-0007).
      path: ["^(?:frontend|backend|e2e)/dist/", "^backend/drizzle/", "boundary-fixtures"],
    },
    parser: "swc",
    tsPreCompilationDeps: true,
  },
};

export default config;
