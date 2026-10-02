"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import { PARTNER_PATHS, isAgreementSigned } from "@/partner-center/lib/review-state";
import {
  beginPartnerStripeOnboarding,
  connectEligibilityFor,
} from "@/partner-center/lib/stripe-connect";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import {
  writePayoutMethodAudit,
  writeTaxAudit,
} from "@/partner-center/settings/lib/tax-audit";
import {
  loadPlatformTaxConfig,
  type PayoutMethodOption,
} from "@/super-admin/partner-center/services/platform-tax-config";

type ActionResult = {
  error?: string;
  redirect?: string;
  ok?: true;
  needsTax?: boolean;
};

function revalidatePayoutPaths() {
  revalidatePath(PARTNER_PATHS.payout);
  revalidatePath(PARTNER_PATHS.checklist);
  revalidatePath(PARTNER_PATHS.settingsTax);
  revalidatePath(PARTNER_PATHS.settingsTaxSetup);
  revalidatePath(PARTNER_PATHS.settingsTaxStripe);
  revalidatePath(PARTNER_PATHS.payoutApp);
  revalidatePath("/partner-center/payout");
}

async function loadPartnerWriter() {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to continue." } as const;
  }
  const session = await getSessionProfile();
  if (!session) return { error: "Sign in to continue." } as const;
  const entitled = session.entitlements.some(
    (item) =>
      item.product === "partner_center" &&
      (item.status === "active" || item.status === "trial"),
  );
  if (!entitled) {
    return {
      error: "Partner Center access is not available for this account.",
    } as const;
  }
  const supabase = await createClient();
  const context = await resolvePartner(session.user, session.entitlements);
  if (!context?.profile) {
    return { error: "No partner application was found." } as const;
  }
  if (
    context.profile.status !== "approved" &&
    context.profile.status !== "active"
  ) {
    return {
      error: "Payout setup is available after your application is approved.",
    } as const;
  }
  if (!isAgreementSigned(context.profile.agreement_status)) {
    return {
      error: "Sign the Partner Agreement before continuing setup.",
    } as const;
  }
  return { supabase, context, userId: session.user.id } as const;
}

function nonStripeTaxHref(
  profileStatus: string,
  method: PayoutMethodOption,
) {
  return profileStatus === "approved"
    ? `${PARTNER_PATHS.tax}?from=${method}`
    : `${PARTNER_PATHS.settingsTaxSetup}?from=${method}`;
}

function nonStripeDoneHref(profileStatus: string) {
  return profileStatus === "approved"
    ? PARTNER_PATHS.checklist
    : PARTNER_PATHS.settingsTax;
}

export async function selectPreferredPayoutMethod(
  method: PayoutMethodOption,
): Promise<ActionResult> {
  const loaded = await loadPartnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context, userId } = loaded;
  const profile = context.profile!;

  const admin = createAdminClient();
  if (!admin) return { error: "Admin client is not configured." };

  const platform = await loadPlatformTaxConfig(admin);
  if (!platform.availablePayoutMethods.includes(method)) {
    return { error: "That payout method is not available." };
  }

  const previous =
    (profile as { preferred_payout_method?: string | null })
      .preferred_payout_method ?? null;

  if (method === "stripe_connect") {
    const { error: preferredError } = await supabase
      .from("partner_profiles")
      .update({ preferred_payout_method: method })
      .eq("id", profile.id);
    if (preferredError) return { error: partnerFacingError("Could not update payout settings.", preferredError.message) };

    if (previous !== method) {
      const audit = await writePayoutMethodAudit(supabase, {
        actorUserId: userId,
        entityId: profile.id,
        previousMethod: previous,
        newMethod: method,
        reason: "Partner selected Stripe Connect",
      });
      if (audit.error) return { error: audit.error };
    }

    const result = await beginPartnerStripeOnboarding({
      supabase,
      profile: { ...profile, preferred_payout_method: method },
      actorUserId: userId,
    });
    if (result.error) return { error: result.error };
    revalidatePayoutPaths();
    return { redirect: result.redirect };
  }

  const { data: tax } = await supabase
    .from("partner_tax_profiles")
    .select("id, status, collection_source")
    .eq("partner_profile_id", profile.id)
    .maybeSingle();

  const taxComplete =
    tax?.status === "complete" || profile.tax_profile_status === "complete";

  // Idempotent re-select when already preferred
  if (previous === method) {
    if (!taxComplete) {
      revalidatePayoutPaths();
      return {
        ok: true,
        needsTax: true,
        redirect: nonStripeTaxHref(profile.status, method),
      };
    }
    const paymentStatus =
      profile.payment_setup_status === "on_hold" ? "on_hold" : "ready";
    const payout_eligibility = connectEligibilityFor("complete", paymentStatus);
    if (
      profile.payment_setup_status !== paymentStatus ||
      profile.payout_eligibility !== payout_eligibility
    ) {
      const { error: syncError } = await supabase
        .from("partner_profiles")
        .update({
          payment_setup_status: paymentStatus,
          payout_eligibility,
        })
        .eq("id", profile.id);
      if (syncError) return { error: partnerFacingError("Could not update payout settings.", syncError.message) };
    }
    revalidatePayoutPaths();
    return { ok: true, redirect: nonStripeDoneHref(profile.status) };
  }

  if (!taxComplete) {
    const { error: updateError } = await supabase
      .from("partner_profiles")
      .update({
        preferred_payout_method: method,
        payment_setup_status:
          profile.payment_setup_status === "on_hold"
            ? "on_hold"
            : "incomplete",
        payout_eligibility:
          profile.payout_eligibility === "on_hold"
            ? "on_hold"
            : "needs_tax_setup",
      })
      .eq("id", profile.id);
    if (updateError) return { error: partnerFacingError("Could not update payout settings.", updateError.message) };

    const audit = await writePayoutMethodAudit(supabase, {
      actorUserId: userId,
      entityId: profile.id,
      previousMethod: previous,
      newMethod: method,
      reason: "Partner selected non-Stripe payout; tax profile incomplete",
    });
    if (audit.error) return { error: audit.error };

    revalidatePayoutPaths();
    return {
      ok: true,
      needsTax: true,
      redirect: nonStripeTaxHref(profile.status, method),
    };
  }

  const paymentStatus =
    profile.payment_setup_status === "on_hold" ? "on_hold" : "ready";
  const payout_eligibility = connectEligibilityFor("complete", paymentStatus);

  const { error: readyError } = await supabase
    .from("partner_profiles")
    .update({
      preferred_payout_method: method,
      payment_setup_status: paymentStatus,
      payout_eligibility,
    })
    .eq("id", profile.id);
  if (readyError) return { error: partnerFacingError("Could not update payout settings.", readyError.message) };

  const audit = await writePayoutMethodAudit(supabase, {
    actorUserId: userId,
    entityId: profile.id,
    previousMethod: previous,
    newMethod: method,
    reason: "Partner selected non-Stripe payout with complete tax profile",
  });
  if (audit.error) return { error: audit.error };

  revalidatePayoutPaths();
  return {
    ok: true,
    redirect: nonStripeDoneHref(profile.status),
  };
}

/**
 * Clear linked Stripe Connect account so the partner can reconnect / retest.
 * Does not change preferred_payout_method.
 */
export async function disconnectPartnerStripe(): Promise<ActionResult> {
  const loaded = await loadPartnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context, userId } = loaded;
  const profile = context.profile!;

  const previousId = profile.stripe_connect_account_id?.trim() || null;
  if (!previousId) {
    return {
      ok: true,
      redirect:
        profile.status === "approved"
          ? PARTNER_PATHS.payout
          : "/partner-center/payout",
    };
  }

  const payout_eligibility =
    profile.payout_eligibility === "on_hold"
      ? "on_hold"
      : profile.tax_profile_status === "complete"
        ? "needs_payment_setup"
        : "needs_tax_setup";
  const payment_setup_status =
    profile.payment_setup_status === "on_hold" ? "on_hold" : "incomplete";

  const { error: updateError } = await supabase
    .from("partner_profiles")
    .update({
      stripe_connect_account_id: null,
      payment_setup_status,
      payout_eligibility,
    })
    .eq("id", profile.id);
  if (updateError) return { error: partnerFacingError("Could not update payout settings.", updateError.message) };

  const audit = await writeTaxAudit(supabase, {
    actorUserId: userId,
    entityType: "partner_profile",
    entityId: profile.id,
    action: "payment_setup_disconnected",
    previousValue: {
      stripe_connect_account_id: previousId,
      payment_setup_status: profile.payment_setup_status,
      payout_eligibility: profile.payout_eligibility,
    },
    newValue: {
      stripe_connect_account_id: null,
      payment_setup_status,
      payout_eligibility,
    },
    reason: "Partner disconnected Stripe Connect",
  });
  if (audit.error) return { error: audit.error };

  revalidatePayoutPaths();
  return {
    ok: true,
    redirect:
      profile.status === "approved"
        ? PARTNER_PATHS.payout
        : "/partner-center/payout",
  };
}
