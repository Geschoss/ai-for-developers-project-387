import { bookSlot } from "../../api/book-slot";

/** Proves the presentation model does not call the booking API (ADR-0007). */
const modelImportsBooking = bookSlot;

export { modelImportsBooking };
