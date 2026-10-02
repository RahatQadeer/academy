import type { DemoReason, PortalContext } from "@/client-portal/lib/portal-context";
import { BILLING_HAS_LIVE_SOURCE } from "@/client-portal/lib/data/billing";
import { SampleDataNotice } from "./States";

const REASONS: Record<DemoReason, string> = {
  portal_closed:
    "Your adviser has closed this portal. Nothing here is live, and your account is unaffected — they will reopen it when they are ready.",
  supabase_unconfigured:
    "Supabase is not configured for this environment, so the portal is showing a sample account.",
  no_session:
    "No signed-in session was found, so the portal is showing a sample account.",
  no_contact_link:
    "Your login is not linked to a client contact record yet. Base has no `contacts.user_id` column, so an auth user cannot be matched to a person, showing a sample account until that link exists.",
  no_client_membership:
    "Your contact record is not attached to a client account yet, so the portal is showing a sample account.",
};

/**
 * One banner, one honest sentence. Screens render this whenever the data behind
 * them is not the signed-in person's own — never silently.
 */
export function DataNotice({ context }: { context: PortalContext }) {
  if (context.mode === "live" || !context.demoReason) return null;
  return <SampleDataNotice reason={REASONS[context.demoReason]} />;
}

/**
 * The banner the billing flag was written to drive.
 *
 * `BILLING_HAS_LIVE_SOURCE` has been exported since this screen was built and
 * read by nothing, so the banner showed whether or not there was a real source
 * behind it. There is one now — `whitbyos_invoices`, from whitbyos/059 — and
 * the flag finally decides, which is what its own comment always said it did.
 * A demo session still says so through `DataNotice` above.
 */
export function BillingDataNotice() {
  if (BILLING_HAS_LIVE_SOURCE) return null;

  return (
    <SampleDataNotice reason="Invoices have no table in the shared schema yet, billing is read from QuickBooks through an adapter WhitbyOS still owns. Showing sample invoices." />
  );
}
