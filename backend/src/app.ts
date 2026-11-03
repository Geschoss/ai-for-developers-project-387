import "reflect-metadata";
import { createRequire } from "node:module";
import { join } from "node:path";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import express, { type RequestHandler } from "express";
import { middleware as openApiMiddleware } from "express-openapi-validator";

import type { AppOptions } from "./app-options.js";
import { AppModule } from "./app.module.js";
import { ProblemFilter } from "./platform/problem.filter.js";

const apiSpec = createRequire(import.meta.url).resolve("spec/openapi.yaml");

const isApiPath = (path: string): boolean => path === "/api" || path.startsWith("/api/");

/** Client-side routes: any GET outside `/api` that is not a static file gets `index.html`. */
const spaFallback = (spaDir: string): RequestHandler => {
  const indexHtml = join(spaDir, "index.html");
  return (req, res, next) => {
    if ((req.method === "GET" || req.method === "HEAD") && !isApiPath(req.path)) {
      res.sendFile(indexHtml);
      return;
    }
    next();
  };
};

/**
 * Builds the whole app: `/api/*` validated against `spec/openapi.yaml` (ADR-0001), errors as problem+json, and the
 * SPA for every other path. The caller calls `init()` or `listen()`; migrations run then.
 */
const createApp = async (options: AppOptions): Promise<NestExpressApplication> => {
  // Nest's own body parser would run after the validator, which needs the parsed body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(options), {
    bodyParser: false,
  });
  // One proxy hop: Render's TLS terminator. Local HTTP then has request.secure === false (ADR-0005).
  app.set("trust proxy", 1);
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ProblemFilter());
  app.use(express.json(), cookieParser());
  app.use(
    openApiMiddleware({
      apiSpec,
      ignorePaths: (path: string) => !isApiPath(path),
      validateRequests: true,
      validateResponses: false,
    }),
  );
  app.useStaticAssets(options.spaDir);
  app.use(spaFallback(options.spaDir));
  return app;
};

export { createApp };
