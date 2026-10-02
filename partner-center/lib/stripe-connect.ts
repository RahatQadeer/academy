import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/base/auth/site";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  createAccountOnboardingLink,
  createExpressAccount,
  mapAccountToPaymentStatus,
  retrieveConnectAccount,
  stripeAccountUpdateNotAllowed,
  stripeConfigured,
  stripeConnectAccountUnreachable,
  stripeErrorMessage,
  type ConnectPaymentStatus,
} from "@/partner-center/lib/stripe";
import { writeTaxAudit } from "@/partner-center/settings/lib/tax-audit";
import type { PartnerProfile, PartnerTaxStatus } from "@/partner-center/types/partner";

function eligibilityAfterClearingConnect(taxStatus: string) {
  return taxStatus === "complete" ? "needs_payment_setup" : "needs_tax_setup";
}

export function connectEligibilityFor(
  taxStatus: PartnerTaxStatus | string,
  paymentStatus: ConnectPaymentStatus | string,
): string {
  if (paymentStatus === "on_hold") return "on_hold";
  if (taxStatus !== "complete") return "needs_tax_setup";
  if (paymentStatus !== "ready") return "needs_payment_setup";
  return "eligible";
}

function absolutePartnerUrl(path: string) {
  return new URL(path, siteUrl()).toString();
}

function stripeConnectUrls(profile: PartnerProfile) {
  if (profile.status === "approved") {
    return {
      returnUrl: absolutePartnerUrl(PARTNER_PATHS.payoutStripeReturn),
      refreshUrl: absolutePartnerUrl(PARTNER_PATHS.payoutStripeRefresh),
    };
  }
  return {
    returnUrl: absolutePartnerUrl(PARTNER_PATHS.settingsTaxStripeReturn),
    refreshUrl: absolutePartnerUrl(PARTNER_PATHS.settingsTaxStripeRefresh),
  };
}

async function loadCountryAndEmail(
  supabase: SupabaseClient,
  profile: PartnerProfile,
): Promise<{
  country: string | null;
  email: string | null;
  displayName: string | null;
}> {
  const [{ data: tax }, { data: contact }, { data: company }] =
    await Promise.all([
      supabase
        .from("partner_tax_profiles")
        .select("country, legal_payee_name, business_dba_name")
        .eq("partner_profile_id", profile.id)
        .maybeSingle(),
      supabase
        .from("contacts")
        .select("email")
        .eq("id", profile.primary_contact_id)
        .maybeSingle(),
      supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .maybeSingle(),
    ]);
  const displayName =
    (tax?.business_dba_name as string | null)?.trim() ||
    (tax?.legal_payee_name as string | null)?.trim() ||
    (company?.name as string | null)?.trim() ||
    null;
  return {
    country: (tax?.country as string | null) ?? null,
    email: (contact?.email as string | null) ?? null,
    displayName,
  };
}

/**
 * Create (or reuse) Express account + Account Link; mark payment incomplete.
 * Returns a Stripe-hosted URL in `redirect`.
 * Unreachable/stale stored account IDs are cleared and recreated.
 */
export async function beginPartnerStripeOnboarding(opts: {
  supabase: SupabaseClient;
  profile: PartnerProfile;
  actorUserId: string;
}): Promise<{ error?: string; redirect?: string }> {
  if (!stripeConfigured()) {
    return {
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY in the environment.",
    };
  }

  const { supabase, profile, actorUserId } = opts;
  const previous = {
    payment_setup_status: profile.payment_setup_status,
    payout_eligibility: profile.payout_eligibility,
    stripe_connect_account_id: profile.stripe_connect_account_id,
  };

  let accountId = profile.stripe_connect_account_id?.trim() || null;
  let stripePaymentStatus: ConnectPaymentStatus = "incomplete";

  async function createNewAccount(): Promise<{ error?: string }> {
    try {
      const meta = await loadCountryAndEmail(supabase, profile);
      const account = await createExpressAccount({
        partnerProfileId: profile.id,
        country: meta.country,
        email: meta.email,
        displayName: meta.displayName,
      });
      accountId = account.id;
      stripePaymentStatus = mapAccountToPaymentStatus(account);
      return {};
    } catch (caught) {
      return {
        error: stripeErrorMessage(
          caught,
          "Could not create Stripe Connect account.",
        ),
      };
    }
  }

  async function clearStaleAccount(staleId: string): Promise<{ error?: string }> {
    const payout_eligibility = eligibilityAfterClearingConnect(
      profile.tax_profile_status,
    );
    const { error: clearError } = await supabase
      .from("partner_profiles")
      .update({
        stripe_connect_account_id: null,
        payment_setup_status: "incomplete",
        payout_eligibility,
      })
      .eq("id", profile.id);
    if (clearError) return { error: partnerFacingError("Could not connect to Stripe.", clearError.message) };

    const audit = await writeTaxAudit(supabase, {
      actorUserId,
      entityType: "partner_profile",
      entityId: profile.id,
      action: "payment_setup_stale_cleared",
      previousValue: {
        stripe_connect_account_id: staleId,
        payment_setup_status: profile.payment_setup_status,
        payout_eligibility: profile.payout_eligibility,
      },
      newValue: {
        stripe_connect_account_id: null,
        payment_setup_status: "incomplete",
        payout_eligibility,
      },
      reason: "Stale Connect account cleared; recreating",
    });
    if (audit.error) return { error: audit.error };
    accountId = null;
    stripePaymentStatus = "incomplete";
    return {};
  }

  if (accountId) {
    try {
      const account = await retrieveConnectAccount(accountId);
      stripePaymentStatus = mapAccountToPaymentStatus(account);
    } catch (caught) {
      if (!stripeConnectAccountUnreachable(caught)) {
        return {
          error: stripeErrorMessage(
            caught,
            "Could not load Stripe Connect account.",
          ),
        };
      }
      const cleared = await clearStaleAccount(accountId);
      if (cleared.error) return { error: cleared.error };
      const created = await createNewAccount();
      if (created.error) return { error: created.error };
    }
  } else {
    const created = await createNewAccount();
    if (created.error) return { error: created.error };
  }

  if (!accountId) {
    return { error: "Could not create Stripe Connect account." };
  }

  let payout_eligibility = connectEligibilityFor(
    profile.tax_profile_status,
    stripePaymentStatus,
  );

  const { error: updateError } = await supabase
    .from("partner_profiles")
    .update({
      stripe_connect_account_id: accountId,
      payment_setup_status: stripePaymentStatus,
      payout_eligibility,
    })
    .eq("id", profile.id);
  if (updateError) return { error: partnerFacingError("Could not connect to Stripe.", updateError.message) };

  const linkType =
    stripePaymentStatus === "ready" ? "account_update" : "account_onboarding";

  let linkUrl: string;
  const { returnUrl, refreshUrl } = stripeConnectUrls(profile);
  try {
    const link = await createAccountOnboardingLink({
      accountId,
      returnUrl,
      refreshUrl,
      type: linkType,
    });
    linkUrl = link.url;
  } catch (caught) {
    if (linkType === "account_update" && stripeAccountUpdateNotAllowed(caught)) {
      try {
        const link = await createAccountOnboardingLink({
          accountId,
          returnUrl,
          refreshUrl,
          type: "account_onboarding",
        });
        linkUrl = link.url;
        stripePaymentStatus = "incomplete";
        payout_eligibility = connectEligibilityFor(
          profile.tax_profile_status,
          stripePaymentStatus,
        );
        const { error: syncError } = await supabase
          .from("partner_profiles")
          .update({
            payment_setup_status: stripePaymentStatus,
            payout_eligibility,
          })
          .eq("id", profile.id);
        if (syncError) return { error: partnerFacingError("Could not connect to Stripe.", syncError.message) };
      } catch (retryCaught) {
        return {
          error: stripeErrorMessage(
            retryCaught,
            "Could not open Stripe onboarding.",
          ),
        };
      }
    } else if (stripeConnectAccountUnreachable(caught)) {
      const cleared = await clearStaleAccount(accountId);
      if (cleared.error) return { error: cleared.error };
      const created = await createNewAccount();
      if (created.error) return { error: created.error };
      if (!accountId) {
        return { error: "Could not create Stripe Connect account." };
      }
      payout_eligibility = connectEligibilityFor(
        profile.tax_profile_status,
        stripePaymentStatus,
      );
      const { error: recreateError } = await supabase
        .from("partner_profiles")
        .update({
          stripe_connect_account_id: accountId,
          payment_setup_status: stripePaymentStatus,
          payout_eligibility,
        })
        .eq("id", profile.id);
      if (recreateError) return { error: partnerFacingError("Could not connect to Stripe.", recreateError.message) };
      try {
        const link = await createAccountOnboardingLink({
          accountId,
          returnUrl,
          refreshUrl,
          type: "account_onboarding",
        });
        linkUrl = link.url;
      } catch (retryCaught) {
        return {
          error: stripeErrorMessage(
            retryCaught,
            "Could not open Stripe onboarding.",
          ),
        };
      }
    } else {
      return {
        error: stripeErrorMessage(caught, "Could not open Stripe onboarding."),
      };
    }
  }

  if (stripePaymentStatus !== "ready") {
    const audit = await writeTaxAudit(supabase, {
      actorUserId,
      entityType: "partner_profile",
      entityId: profile.id,
      action: "payment_setup_started",
      previousValue: previous,
      newValue: {
        payment_setup_status: stripePaymentStatus,
        payout_eligibility,
        stripe_connect_account_id: accountId,
      },
      reason: "Partner started Stripe Connect setup",
    });
    if (audit.error) return { error: audit.error };
  }

  return { redirect: linkUrl };
}

/**
 * Retrieve Connect account and persist payment_setup_status + eligibility.
 */
export async function syncPartnerStripeAccount(opts: {
  supabase: SupabaseClient;
  profile: PartnerProfile;
  actorUserId?: string | null;
  reason?: string;
}): Promise<{
  error?: string;
  payment_setup_status?: ConnectPaymentStatus;
  redirect?: string;
}> {
  if (!stripeConfigured()) {
    return {
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY in the environment.",
    };
  }

  const accountId = opts.profile.stripe_connect_account_id?.trim();
  if (!accountId) {
    return { error: "No Stripe Connect account is linked to this partner." };
  }

  let account;
  try {
    account = await retrieveConnectAccount(accountId);
  } catch (caught) {
    if (!stripeConnectAccountUnreachable(caught)) {
      return {
        error: stripeErrorMessage(
          caught,
          "Could not load Stripe Connect account.",
        ),
      };
    }

    const payout_eligibility = eligibilityAfterClearingConnect(
      opts.profile.tax_profile_status,
    );
    const previous = {
      payment_setup_status: opts.profile.payment_setup_status,
      payout_eligibility: opts.profile.payout_eligibility,
      stripe_connect_account_id: accountId,
    };
    const { error: clearError } = await opts.supabase
      .from("partner_profiles")
      .update({
        stripe_connect_account_id: null,
        payment_setup_status: "incomplete",
        payout_eligibility,
      })
      .eq("id", opts.profile.id);
    if (clearError) return { error: partnerFacingError("Could not connect to Stripe.", clearError.message) };

    if (opts.actorUserId) {
      await writeTaxAudit(opts.supabase, {
        actorUserId: opts.actorUserId,
        entityType: "partner_profile",
        entityId: opts.profile.id,
        action: "payment_setup_stale_cleared",
        previousValue: previous,
        newValue: {
          payment_setup_status: "incomplete",
          payout_eligibility,
          stripe_connect_account_id: null,
        },
        reason: "Stale Connect account cleared; reconnect required",
      });
    }

    return {
      payment_setup_status: "incomplete",
      redirect:
        opts.profile.status === "approved"
          ? PARTNER_PATHS.payout
          : PARTNER_PATHS.settingsTaxStripe,
    };
  }

  const payment_setup_status = mapAccountToPaymentStatus(account);
  const payout_eligibility = connectEligibilityFor(
    opts.profile.tax_profile_status,
    payment_setup_status,
  );

  const previous = {
    payment_setup_status: opts.profile.payment_setup_status,
    payout_eligibility: opts.profile.payout_eligibility,
  };

  const { error } = await opts.supabase
    .from("partner_profiles")
    .update({
      payment_setup_status,
      payout_eligibility,
    })
    .eq("id", opts.profile.id);
  if (error) return { error: partnerFacingError("Could not connect to Stripe.", error.message) };

  if (opts.actorUserId) {
    const audit = await writeTaxAudit(opts.supabase, {
      actorUserId: opts.actorUserId,
      entityType: "partner_profile",
      entityId: opts.profile.id,
      action:
        payment_setup_status === "ready"
          ? "payment_setup_ready"
          : "payment_setup_synced",
      previousValue: previous,
      newValue: { payment_setup_status, payout_eligibility },
      reason:
        opts.reason ??
        (payment_setup_status === "ready"
          ? "Partner completed Stripe Connect onboarding"
          : "Synced Stripe Connect account status"),
    });
    if (audit.error) return { error: audit.error };
  }

  return {
    payment_setup_status,
    redirect:
      opts.profile.status === "approved"
        ? PARTNER_PATHS.checklist
        : PARTNER_PATHS.settingsTax,
  };
}

/**
 * Re-pull Connect status when the partner looks stuck on hold / incomplete after
 * onboarding. Returns an updated profile (or the original if no refresh ran).
 */
export async function refreshStalePartnerStripeStatus(opts: {
  supabase: SupabaseClient;
  profile: PartnerProfile;
  actorUserId?: string | null;
}): Promise<PartnerProfile> {
  const linked = opts.profile.stripe_connect_account_id?.trim();
  if (!linked) return opts.profile;

  const setup = (opts.profile.payment_setup_status || "").toLowerCase();
  const shouldRefresh =
    setup === "on_hold" ||
    setup === "incomplete" ||
    opts.profile.payout_eligibility === "on_hold";
  if (!shouldRefresh) return opts.profile;

  await syncPartnerStripeAccount({
    supabase: opts.supabase,
    profile: opts.profile,
    actorUserId: opts.actorUserId,
    reason: "Refresh stale Connect status after onboarding",
  });

  const { data: refreshed } = await opts.supabase
    .from("partner_profiles")
    .select(
      "tax_profile_status, payment_setup_status, payout_eligibility, preferred_payout_method, stripe_connect_account_id",
    )
    .eq("id", opts.profile.id)
    .maybeSingle();

  if (!refreshed) return opts.profile;

  return {
    ...opts.profile,
    tax_profile_status:
      refreshed.tax_profile_status as PartnerProfile["tax_profile_status"],
    payment_setup_status: refreshed.payment_setup_status as string | null,
    payout_eligibility:
      refreshed.payout_eligibility as PartnerProfile["payout_eligibility"],
    preferred_payout_method:
      (refreshed.preferred_payout_method as PartnerProfile["preferred_payout_method"]) ??
      null,
    stripe_connect_account_id:
      (refreshed.stripe_connect_account_id as string | null) ?? null,
  };
}

/**
 * Webhook / admin path: sync by connected account id (service role).
 */
export async function syncPartnerStripeByAccountId(opts: {
  supabase: SupabaseClient;
  accountId: string;
  deauthorized?: boolean;
  actorUserId?: string | null;
}): Promise<{ error?: string; skipped?: boolean }> {
  const { data: profile, error: lookupError } = await opts.supabase
    .from("partner_profiles")
    .select("*")
    .eq("stripe_connect_account_id", opts.accountId)
    .maybeSingle();
  if (lookupError) return { error: partnerFacingError("Could not connect to Stripe.", lookupError.message) };
  if (!profile) return { skipped: true };

  if (opts.deauthorized) {
    const previous = {
      payment_setup_status: profile.payment_setup_status,
      payout_eligibility: profile.payout_eligibility,
      stripe_connect_account_id: profile.stripe_connect_account_id,
    };
    const taxStatus = profile.tax_profile_status as string;
    const payout_eligibility =
      taxStatus === "complete" ? "needs_payment_setup" : "needs_tax_setup";
    const { error } = await opts.supabase
      .from("partner_profiles")
      .update({
        stripe_connect_account_id: null,
        payment_setup_status: "incomplete",
        payout_eligibility,
      })
      .eq("id", profile.id);
    if (error) return { error: partnerFacingError("Could not connect to Stripe.", error.message) };

    if (opts.actorUserId) {
      await writeTaxAudit(opts.supabase, {
        actorUserId: opts.actorUserId,
        entityType: "partner_profile",
        entityId: profile.id as string,
        action: "payment_setup_deauthorized",
        previousValue: previous,
        newValue: {
          payment_setup_status: "incomplete",
          payout_eligibility,
          stripe_connect_account_id: null,
        },
        reason: "Stripe Connect account deauthorized",
      });
    }
    return {};
  }

  const result = await syncPartnerStripeAccount({
    supabase: opts.supabase,
    profile: profile as PartnerProfile,
    actorUserId: opts.actorUserId,
    reason: "Stripe Connect webhook account.updated",
  });
  if (result.error) return { error: result.error };
  return {};
}
