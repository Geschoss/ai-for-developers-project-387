import { AdminUsers } from "../../administration/AdminUsers";

/** Proves Идентификация screens do not import Администрирование (ADR-0007). */
const identityImportsAdministration = AdminUsers;

export { identityImportsAdministration };
