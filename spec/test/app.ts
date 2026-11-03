import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import { middleware as openApiMiddleware } from "express-openapi-validator";

/** A cookie the validator accepts as a session; whether it is valid is the backend's concern. */
const session = "sid=test-session";

const apiSpec = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const errorBody = (err: unknown): { errors: unknown; message: unknown; status: number } => {
  if (!isRecord(err)) {
    return { errors: undefined, message: "", status: 500 };
  }
  const { errors, message, status } = err;
  let httpStatus = 500;
  if (typeof status === "number") {
    httpStatus = status;
  }
  return { errors, message, status: httpStatus };
};

// oxlint-disable-next-line eslint/max-params -- Express error middleware is (err, req, res, next)
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  // oxlint-disable-next-line typescript/no-unsafe-argument -- Express types the error argument as any
  const body = errorBody(err);
  res.status(body.status).json({ errors: body.errors, message: body.message });
};

/**
 * The validation layer the backend will mount (ADR-0001), with every valid request answered by a stub 200.
 * Tests use it to check what the contract lets through and what it rejects; 200 means "passed validation".
 */
const contractApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(openApiMiddleware({ apiSpec, validateRequests: true, validateResponses: false }));
  app.use((_req, res) => {
    res.status(200).json({ stub: true });
  });
  app.use(onError);
  return app;
};

export { contractApp, session };
