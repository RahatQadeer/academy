import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";
import { getSessionProfile } from "@/base/identity/session";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { Entitlement } from "@/base/types";
import { isPrivilegedPartner } from "@/partner-center/lib/access";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import { beginPartnerStripeOnboarding } from "@/partner-center/lib/stripe-connect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { PartnerProfile } from "@/partner-center/types/partner";

function stripeSetupErrorRedirect(message: string, profile?: PartnerProfile | null) {
  const base =
    profile?.status === "approved"
      ? PARTNER_PATHS.payoutStripe
      : PARTNER_PATHS.settingsTaxStripe;
  return NextResponse.redirect(
    new URL(`${base}?error=${encodeURIComponent(message)}`, siteUrl()),
  );
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return stripeSetupErrorRedirect("Connect Supabase to continue.");
  }

  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.redirect(new URL("/login?next=/partner-center/settings/tax/stripe", siteUrl()));
  }

  const entitled = session.entitlements.some(
    (item: Entitlement) =>
      item.product === "partner_center" &&
      (item.status === "active" || item.status === "trial"),
  );
  if (!entitled) {
    return NextResponse.redirect(new URL("/switcher", siteUrl()));
  }

  const context = await resolvePartner(session.user, session.entitlements);
  const profile = context?.profile;

  if (!isPrivilegedPartner(context)) {
    return stripeSetupErrorRedirect(
      "Tax and payout setup is limited to Company Admins and Billing contacts.",
      profile,
    );
  }

  if (!profile) {
    return stripeSetupErrorRedirect("No partner application was found.", profile);
  }

  const supabase = await createClient();
  const result = await beginPartnerStripeOnboarding({
    supabase,
    profile,
    actorUserId: session.user.id,
  });

  if (result.error) {
    return stripeSetupErrorRedirect(result.error, profile);
  }

  if (result.redirect) {
    return NextResponse.redirect(result.redirect);
  }

  return stripeSetupErrorRedirect("Stripe did not return an onboarding link.", profile);
}
