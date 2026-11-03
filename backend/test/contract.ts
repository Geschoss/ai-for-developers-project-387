import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import type { Response } from "supertest";
import { expect } from "vitest";
import { parse } from "yaml";

interface ResponseObject {
  content?: Record<string, unknown>;
}

interface Operation {
  responses: Record<string, ResponseObject>;
}

interface OpenApiDocument {
  paths: Record<string, Record<string, Operation>>;
}

const require = createRequire(import.meta.url);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOpenApiDocument = (value: unknown): value is OpenApiDocument =>
  isRecord(value) && isRecord(value["paths"]);

const readSpec = (): OpenApiDocument => {
  const parsed: unknown = parse(readFileSync(require.resolve("spec/openapi.yaml"), "utf8"));
  if (!isOpenApiDocument(parsed)) {
    throw new Error("spec/openapi.yaml is not an OpenAPI document");
  }
  return parsed;
};

const spec = readSpec();

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats.default(ajv);
ajv.addSchema(spec, "openapi");

const pointer = (...segments: string[]): string =>
  segments.map((segment) => segment.replaceAll("~", "~0").replaceAll("/", "~1")).join("/");

const mediaTypeOf = (response: Response): string => {
  const header = response.headers["content-type"];
  if (typeof header !== "string") {
    return "";
  }
  const [mediaType] = header.split(";");
  return mediaType ?? "";
};

const operationOf = (method: string, path: string): Operation => {
  const pathItem = spec.paths[path];
  if (pathItem === undefined) {
    throw new Error(`${method.toUpperCase()} ${path} is not in the spec`);
  }
  const operation = pathItem[method];
  expect(operation, `${method.toUpperCase()} ${path} is not in the spec`).toBeDefined();
  if (operation === undefined) {
    throw new Error(`${method.toUpperCase()} ${path} is not in the spec`);
  }
  return operation;
};

const documentedContent = (operation: Operation, status: string): Record<string, unknown> => {
  const responseObject = operation.responses[status];
  if (responseObject === undefined || responseObject.content === undefined) {
    return {};
  }
  const { content } = responseObject;
  return content;
};

/**
 * Asserts that a response is one the spec documents for the operation: its status is listed, and its content type
 * and body match that response's schema. Every integration test checks responses this way (ADR-0001).
 */
const expectBody = (
  response: Response,
  documented: { method: string; path: string; status: string },
): void => {
  const content = documentedContent(
    operationOf(documented.method, documented.path),
    documented.status,
  );
  if (Object.keys(content).length === 0) {
    expect(response.text).toBe("");
    return;
  }
  const mediaType = mediaTypeOf(response);
  expect(Object.keys(content), `content type ${mediaType} is not documented`).toContain(mediaType);
  const ref = `openapi#/${pointer("paths", documented.path, documented.method, "responses", documented.status, "content", mediaType, "schema")}`;
  const validate = ajv.compile({ $ref: ref });
  validate(response.body);
  expect(validate.errors ?? []).toEqual([]);
};

const expectMatchesSpec = (response: Response, method: string, path: string): void => {
  const operation = operationOf(method, path);
  const status = String(response.status);
  expect(Object.keys(operation.responses), `status ${status} is not documented`).toContain(status);
  expectBody(response, { method, path, status });
};

export { expectMatchesSpec };
