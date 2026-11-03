import { Injectable } from "@nestjs/common";

/** Proves the domain rule: this file must not be reachable from a normal cruise. */
const domainImportsNest = Injectable;

export { domainImportsNest };
