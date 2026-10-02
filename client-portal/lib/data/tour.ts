import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";

/** Where the answer is kept — see `portalTourSeen`. */
export const TOUR_KEY = "portal_tour_seen_at";

/**
 * Whether this client has already been shown the way around.
 *
 * Kept on the contact's `enrichment_data`, not on `users.tour_seen_at`. That
 * column is Whitby's: it is set when a professional finishes the six steps on
 * their own dashboard, and a person who is both — a professional who has also
 * accepted a client's invitation, which nothing prevents — would have had one
 * product's tour marked seen by the other. The portal keys its own records by
 * contact everywhere else, and this is one of its own records.
 *
 * A sibling of `portal_preferences` rather than a field inside it: saving the
 * Preferences screen replaces that object wholesale, so a flag stored in it
 * would be erased by the next save and the tour would start again over
 * somebody who had already dismissed it twice.
 *
 * Returns true for a session with no contact — the sample account, and a login
 * still being linked. Nothing there can record an answer, so an automatic tour
 * would be shown again on every navigation with no way to stop it. `?tour=1`
 * still opens it by hand.
 */
export async function portalTourSeen(): Promise<boolean> {
  const context = await getPortalContext();
  if (context.mode !== "live" || !context.contactId) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("enrichment_data")
    .eq("id", context.contactId)
    .maybeSingle();

  const enrichment = (data?.enrichment_data as Record<string, unknown> | null) ?? {};
  return Boolean(enrichment[TOUR_KEY]);
}
