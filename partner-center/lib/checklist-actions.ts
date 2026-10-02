"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  parseApplicationData,
  toCompanyFields,
  toContactFields,
} from "@/partner-center/lib/application-map";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import { getOrCreateReferralLink } from "@/partner-center/lib/referral-link-store";
import {
  buildChecklistItems,
  isReferralChecklistUnlocked,
} from "@/partner-center/lib/checklist-state";
import { PARTNER_PATHS, isAgreementSigned } from "@/partner-center/lib/review-state";
import {
  beginPartnerStripeOnboarding,
  syncPartnerStripeAccount,
} from "@/partner-center/lib/stripe-connect";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { ensureOpeningStaffMessage } from "@/partner-center/messages/lib/ensure-opening-message";
import {
  ensureActivePartnerPrograms,
  partnerHasActivePrograms,
} from "@/partner-center/lib/enable-programs";
import type { ApplicationData } from "@/partner-center/types/application";
import type { PartnerContext } from "@/partner-center/types/partner";

type ActionResult = { error?: string; redirect?: string };
type WriterOk = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: PartnerContext;
};

/** Checklist ids that must be done before status can flip to active. */
const ACTIVATION_REQUIRED_IDS = new Set([
  "company",
  "contact",
  "agreement",
  "programs",
  "guide",
]);

export type TaxDraft = {
  us_person: boolean;
  legal_payee_name: string;
  entity_classification: string;
  /** When set, overrides the default post-save redirect to payout setup. */
  redirect_to?: string;
};

async function partnerWriter(): Promise<{ error: string } | WriterOk> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to continue." };
  }
  const session = await getSessionProfile();
  if (!session) return { error: "Sign in to continue." };
  const entitled = session.entitlements.some(
    (item) =>
      item.product === "partner_center" &&
      (item.status === "active" || item.status === "trial"),
  );
  if (!entitled) {
    return { error: "Partner Center access is not available for this account." };
  }
  const supabase = await createClient();
  const context = await resolvePartner(session.user, session.entitlements);
  if (!context?.profile) return { error: "No partner application was found." };
  if (context.profile.status !== "approved" && context.profile.status !== "active") {
    return { error: "Finish setup is available after your application is approved." };
  }
  if (!isAgreementSigned(context.profile.agreement_status)) {
    return { error: "Sign the Partner Agreement before continuing setup." };
  }
  return { supabase, context };
}

async function patchApplication(
  supabase: WriterOk["supabase"],
  context: PartnerContext,
  patch: Partial<ApplicationData>,
  extra?: Record<string, unknown>,
) {
  const profile = context.profile;
  if (!profile) return { error: "No partner application was found." };
  const data: ApplicationData = {
    ...parseApplicationData(profile.application_data),
    ...patch,
  };
  const { error } = await supabase
    .from("partner_profiles")
    .update({ application_data: data, ...extra })
    .eq("id", profile.id);
  if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };
  return {};
}

export async function saveCompanyProfile(incoming: {
  legal_name: string;
  website: string;
  address: string;
  market: string;
  audience_served: string;
}): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context } = loaded;
  const legal_name = incoming.legal_name.trim();
  if (!legal_name) return { error: "Enter a company name." };

  const data: ApplicationData = {
    ...parseApplicationData(context.profile?.application_data),
    legal_name,
    website: incoming.website.trim(),
    address: incoming.address.trim(),
    market: incoming.market.trim(),
    audience_served: incoming.audience_served.trim(),
  };

  if (context.company) {
    const { error } = await supabase
      .from("companies")
      .update(toCompanyFields(data))
      .eq("id", context.company.id);
    if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };
  }

  const saved = await patchApplication(supabase, context, data);
  if (saved.error) return saved;
  return { redirect: PARTNER_PATHS.checklist };
}

export async function savePrimaryContact(incoming: {
  primary_contact_name: string;
  phone: string;
  email: string;
}): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context } = loaded;
  const primary_contact_name = incoming.primary_contact_name.trim();
  const email = incoming.email.trim();
  if (!primary_contact_name) return { error: "Enter a primary contact name." };
  if (!email) return { error: "Enter an email address." };

  const data: ApplicationData = {
    ...parseApplicationData(context.profile?.application_data),
    primary_contact_name,
    phone: incoming.phone.trim(),
    email,
  };

  if (context.contact) {
    const { error } = await supabase
      .from("contacts")
      .update(toContactFields(data))
      .eq("id", context.contact.id);
    if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };
  }

  const saved = await patchApplication(supabase, context, data);
  if (saved.error) return saved;
  return { redirect: PARTNER_PATHS.checklist };
}

export async function confirmProgramTerms(): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const saved = await patchApplication(loaded.supabase, loaded.context, {
    programs_confirmed_at: new Date().toISOString(),
  });
  if (saved.error) return saved;
  return { redirect: PARTNER_PATHS.guide };
}

export async function confirmPartnerGuide(): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const saved = await patchApplication(loaded.supabase, loaded.context, {
    guide_acknowledged_at: new Date().toISOString(),
  });
  if (saved.error) return saved;
  return { redirect: PARTNER_PATHS.checklist };
}

export async function ensureChecklistReferralLink(): Promise<
  ActionResult & { code?: string; url?: string }
> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner application was found." };

  const [{ data: linkRow }, hasActivePrograms] = await Promise.all([
    supabase
      .from("partner_links_codes")
      .select("id")
      .eq("partner_profile_id", profile.id)
      .eq("type", "referral_link")
      .limit(1)
      .maybeSingle(),
    partnerHasActivePrograms(supabase, profile.id),
  ]);

  if (
    !isReferralChecklistUnlocked(context, {
      hasReferralLink: Boolean(linkRow?.id),
      hasActivePrograms,
    })
  ) {
    return {
      error: "Finish the other checklist steps before creating your referral link.",
      redirect: PARTNER_PATHS.checklist,
    };
  }

  return getOrCreateReferralLink(supabase, profile.id);
}

export async function saveTaxProfile(incoming: TaxDraft): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner application was found." };

  const legal_payee_name = incoming.legal_payee_name.trim();
  if (!legal_payee_name) return { error: "Enter the legal payee name." };

  const preferred =
    (profile as { preferred_payout_method?: string | null })
      .preferred_payout_method ?? null;
  const collection_source =
    preferred === "quickbooks"
      ? "quickbooks_w9"
      : preferred === "ach" || preferred === "check"
        ? "other"
        : "stripe_tax";

  const row = {
    partner_profile_id: profile.id,
    legal_payee_name,
    entity_classification: incoming.entity_classification.trim() || null,
    form_type: incoming.us_person ? "w9" : "w8",
    status: "complete" as const,
    collection_source,
    last_reviewed_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("partner_tax_profiles")
    .select("id")
    .eq("partner_profile_id", profile.id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("partner_tax_profiles")
      .update(row)
      .eq("id", existing.id);
    if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };
  } else {
    const { error } = await supabase.from("partner_tax_profiles").insert(row);
    if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };
  }

  const nonStripeReady =
    preferred === "quickbooks" ||
    preferred === "ach" ||
    preferred === "check";
  const paymentReady =
    profile.payment_setup_status === "ready" || nonStripeReady;
  const payment_setup_status =
    profile.payment_setup_status === "on_hold"
      ? "on_hold"
      : paymentReady
        ? "ready"
        : "incomplete";

  // Checklist "Continue to Stripe" — prefer Stripe and send them into Connect,
  // not back to a method picker that asks them to connect again.
  const preferStripe = !nonStripeReady;
  const { error } = await supabase
    .from("partner_profiles")
    .update({
      tax_profile_status: "complete",
      payment_setup_status,
      payout_eligibility:
        payment_setup_status === "on_hold"
          ? "on_hold"
          : paymentReady
            ? "eligible"
            : "needs_payment_setup",
      ...(preferStripe
        ? { preferred_payout_method: "stripe_connect" as const }
        : {}),
    })
    .eq("id", profile.id);
  if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };

  return {
    redirect:
      incoming.redirect_to?.trim() ||
      (nonStripeReady ? PARTNER_PATHS.checklist : PARTNER_PATHS.payoutStripe),
  };
}

export async function markPayoutStarted(): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const profile = loaded.context.profile;
  if (!profile) return { error: "No partner application was found." };

  const result = await beginPartnerStripeOnboarding({
    supabase: loaded.supabase,
    profile,
    actorUserId: loaded.context.entitlement.user_id,
  });
  if (result.error) return { error: result.error };
  return { redirect: result.redirect };
}

/** After Stripe return during onboarding checklist — sync status only. */
export async function syncChecklistStripeStatus(): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const profile = loaded.context.profile;
  if (!profile) return { error: "No partner application was found." };

  const result = await syncPartnerStripeAccount({
    supabase: loaded.supabase,
    profile,
    actorUserId: loaded.context.entitlement.user_id,
  });
  if (result.error) return { error: result.error };

  return {
    redirect:
      result.redirect ||
      (profile.status === "approved"
        ? PARTNER_PATHS.checklist
        : PARTNER_PATHS.complete),
  };
}

export async function markPayoutReady(): Promise<ActionResult> {
  return syncChecklistStripeStatus();
}

export async function activatePartnerCenter(options?: {
  skipped?: boolean;
}): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, context } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner application was found." };

  const { data: linkRow } = await supabase
    .from("partner_links_codes")
    .select("id")
    .eq("partner_profile_id", profile.id)
    .eq("type", "referral_link")
    .limit(1)
    .maybeSingle();

  const writer = createAdminClient() ?? supabase;
  const ensured = await ensureActivePartnerPrograms(
    writer,
    profile.id,
    profile.application_data,
  );
  if (ensured.error) return { error: ensured.error };

  const { items } = buildChecklistItems(context, {
    hasReferralLink: Boolean(linkRow?.id),
    hasActivePrograms: true,
  });
  const requiredIds = options?.skipped
    ? ACTIVATION_REQUIRED_IDS
    : new Set(items.map((item) => item.id));
  const incomplete = items.filter(
    (item) => requiredIds.has(item.id) && !item.done,
  );
  if (incomplete.length > 0) {
    const labels = incomplete.map((item) => item.label).join(", ");
    return {
      error: `Finish setup before activating: ${labels}.`,
    };
  }

  const { error } = await supabase
    .from("partner_profiles")
    .update({ status: "active" })
    .eq("id", profile.id);
  if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };

  const opening = await ensureOpeningStaffMessage(writer, profile.id);
  if (opening.error) {
    console.warn("[partner-messages] opening message on activate skipped", opening.error);
  }

  return { redirect: PARTNER_PATHS.app };
}
