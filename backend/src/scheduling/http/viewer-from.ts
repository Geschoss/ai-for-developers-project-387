import type { AccountsService } from "../../identity/accounts.service.js";
import { CalendarSlug } from "../../shared-kernel/calendar-slug.js";
import type { Viewer } from "../domain/viewer.js";

/** An Администратор and a missing session are nobody: they have no Календарь of their own. */
const viewerFrom = async (
  accounts: AccountsService,
  sessionId: string | undefined,
): Promise<Viewer | undefined> => {
  const owner = await accounts.findOwnerViewer(sessionId);
  if (owner === undefined) {
    return undefined;
  }
  return { calendarSlug: CalendarSlug.parse(owner.calendarSlug), id: owner.id };
};

export { viewerFrom };
