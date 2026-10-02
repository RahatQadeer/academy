import { listForms } from "@/client-portal/lib/data/forms";
import { listThreads } from "@/client-portal/lib/data/messages";
import { formNeedsClient } from "@/client-portal/lib/status";
import type { AreaAccess, PortalArea } from "@/client-portal/types";

/**
 * Which screens have something waiting on this person.
 *
 * A form sent back for correction, or a message nobody has read, is only
 * discovered by opening the screen it is on — and somebody who opens the
 * portal to do one thing does not open the other eight. This is what carries
 * it out to the nav, where they are already standing.
 *
 * Read on every screen, so it only asks about areas this client can actually
 * reach, and it answers with booleans rather than counts: a number on a nav
 * has to be right on every page in the product, and "there is something here"
 * is both true and enough to make somebody look.
 *
 * Best effort throughout. A dot that fails to be worked out must not take the
 * page down with it; the screens themselves are the record either way.
 */
export async function waitingAreas(
  areas: AreaAccess,
): Promise<Partial<Record<PortalArea, boolean>>> {
  const [forms, messages] = await Promise.all([
    areas.forms
      ? listForms()
          .then((rows) => rows.some((form) => formNeedsClient(form.status)))
          .catch(() => false)
      : Promise.resolve(false),
    areas.messages
      ? listThreads()
          .then((rows) => rows.some((thread) => thread.unread))
          .catch(() => false)
      : Promise.resolve(false),
  ]);

  return { forms, messages };
}
