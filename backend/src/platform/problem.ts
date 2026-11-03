import { STATUS_CODES } from "node:http";

import { HttpException } from "@nestjs/common";
import type { components } from "spec/api";

type ValidationIssue = components["schemas"]["ValidationIssue"];

interface ProblemBody {
  code: string;
  issues?: ValidationIssue[];
  status: number;
  title: string;
}

/**
 * An RFC 9457 problem to `throw`. `ProblemFilter` copies `code` and `issues` onto the response;
 * status-only framework errors keep the filter's own codes.
 */
const problem = (status: number, code: string, issues?: ValidationIssue[]): HttpException => {
  const body: ProblemBody = {
    code,
    status,
    title: STATUS_CODES[status] ?? "Error",
  };
  if (issues !== undefined) {
    body.issues = issues;
  }
  return new HttpException(body, status);
};

export { type ProblemBody, problem };
