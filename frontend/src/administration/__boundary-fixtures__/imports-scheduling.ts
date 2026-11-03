import { Events } from "../../scheduling/Events";

/** Proves Администрирование screens do not import Планирование (ADR-0007). */
const administrationImportsScheduling = Events;

export { administrationImportsScheduling };
