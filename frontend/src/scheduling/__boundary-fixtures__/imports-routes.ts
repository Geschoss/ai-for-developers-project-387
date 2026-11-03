import { AppRoutes } from "../../app/AppRoutes";

/** Proves a screen does not import the router. That import would cycle (ADR-0007). */
const schedulingImportsRoutes = AppRoutes;

export { schedulingImportsRoutes };
