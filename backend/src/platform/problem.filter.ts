import { STATUS_CODES } from "node:http";

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { components } from "spec/api";

import type { ProblemBody } from "./problem.js";

type ValidationIssue = components["schemas"]["ValidationIssue"];

/** Codes for errors that no feature raises itself: framework 404s, validator rejections, crashes. */
const codeByStatus: Record<number, string> = {
  400: "validation_failed",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  415: "unsupported_media_type",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  return "";
};

const statusOf = (exception: unknown): number => {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  // Express-openapi-validator errors carry `status`.
  if (!isRecord(exception)) {
    return 500;
  }
  const { status } = exception;
  if (typeof status === "number" && status >= 400 && status < 600) {
    return status;
  }
  return 500;
};

const validationIssues = (exception: unknown): ValidationIssue[] | undefined => {
  if (!isRecord(exception) || !Array.isArray(exception["errors"])) {
    return undefined;
  }
  return exception["errors"].map((error: unknown): ValidationIssue => {
    if (!isRecord(error)) {
      return { message: "", path: "" };
    }
    return { message: asString(error["message"]), path: asString(error["path"]) };
  });
};

/** A problem raised by a feature. Framework errors have no `code` of their own. */
const problemFromRecord = (body: Record<string, unknown>, status: number): ProblemBody => {
  const problem: ProblemBody = {
    code: asString(body["code"]),
    status,
    title: STATUS_CODES[status] ?? "Error",
  };
  const issues = validationIssues({ errors: body["issues"] });
  if (issues !== undefined) {
    problem.issues = issues;
  }
  return problem;
};

const raisedProblem = (exception: unknown): ProblemBody | undefined => {
  if (!(exception instanceof HttpException)) {
    return undefined;
  }
  const body: unknown = exception.getResponse();
  if (!isRecord(body) || typeof body["code"] !== "string") {
    return undefined;
  }
  return problemFromRecord(body, exception.getStatus());
};

const statusFrom = (raised: ProblemBody | undefined, exception: unknown): number => {
  if (raised === undefined) {
    return statusOf(exception);
  }
  return raised.status;
};

const attachValidationIssues = (body: ProblemBody, exception: unknown): void => {
  if (body.status !== 400) {
    return;
  }
  const issues = validationIssues(exception);
  if (issues !== undefined) {
    body.issues = issues;
  }
};

const problemBody = (exception: unknown): ProblemBody => {
  const raised = raisedProblem(exception);
  const status = statusFrom(raised, exception);
  const body: ProblemBody = raised ?? {
    code: codeByStatus[status] ?? "internal_error",
    status,
    title: STATUS_CODES[status] ?? "Error",
  };
  if (raised === undefined) {
    attachValidationIssues(body, exception);
  }
  return body;
};

/** Renders every error as RFC 9457 `application/problem+json` with a machine-readable `code`. */
@Catch()
class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const body = problemBody(exception);
    if (body.status >= 500) {
      this.logger.error(exception);
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(body.status)
      .type("application/problem+json")
      .json(body);
  }
}

export { ProblemFilter };
