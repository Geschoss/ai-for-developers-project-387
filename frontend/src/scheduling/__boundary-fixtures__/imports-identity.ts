import { Login } from "../../identity/Login";

/** Proves Планирование screens do not import Идентификация (ADR-0007). */
const schedulingImportsIdentity = Login;

export { schedulingImportsIdentity };
