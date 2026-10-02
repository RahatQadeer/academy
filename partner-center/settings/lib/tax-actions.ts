"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerTaxSettingsAccess } from "@/partner-center/lib/access";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  beginPartnerStripeOnboarding,
  connectEligibilityFor,
  syncPartnerStripeAccount,
} from "@/partner-center/lib/stripe-connect";
import { writeTaxAudit } from "@/partner-center/settings/lib/tax-audit";
import type { PartnerTaxStatus } from "@/partner-center/types/partner";

type ActionResult = { error?: string; redirect?: string; ok?: true };

export type TaxSetupInput = {
  residency: "w9" | "w8" | "unsure";
  legal_payee_name: string;
  business_dba_name: string;
  entity_classification: string;
  mailing_address: string;
  country: string;
  mode: "draft" | "submit";
};

function revalidateTaxPaths() {
  revalidatePath(PARTNER_PATHS.settingsTax);
  revalidatePath(PARTNER_PATHS.settingsTaxSetup);
  revalidatePath(PARTNER_PATHS.settingsTaxStripe);
  revalidatePath(PARTNER_PATHS.checklist);
  revalidatePath(PARTNER_PATHS.app);
}

async function loadWriter() {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to continue." } as const;
  }
  const access = await requirePartnerTaxSettingsAccess();
  if (access.user.id === "preview") {
    return { error: "Connect Supabase to continue." } as const;
  }
  const profile = access.context?.profile;
  if (!profile) return { error: "No partner application was found." } as const;
  const supabase = await createClient();
  return { supabase, access, profile } as const;
}

export async function saveSettingsTaxProfile(
  incoming: TaxSetupInput,
): Promise<ActionResult> {
  const loaded = await loadWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, access, profile } = loaded;

  if (incoming.residency === "unsure") {
    return { error: "Use Submit for review for uncertain tax residency." };
  }

  const legal_payee_name = incoming.legal_payee_name.trim();
  if (!legal_payee_name) return { error: "Enter the legal name." };

  const country = incoming.country.trim() || (incoming.residency === "w9" ? "US" : "");
  if (!country) return { error: "Enter the country." };

  const mailing_address = incoming.mailing_address.trim();
  if (incoming.mode === "submit" && !mailing_address) {
    return { error: "Enter the mailing address." };
  }

  const taxStatus: PartnerTaxStatus =
    incoming.mode === "submit" ? "complete" : "in_progress";
  const now = new Date().toISOString();

  const preferred =
    (profile as { preferred_payout_method?: string | null })
      .preferred_payout_method ?? null;
  const collection_source =
    preferred === "quickbooks"
      ? "quickbooks_w9"
      : preferred === "ach" || preferred === "check"
        ? "other"
        : "stripe_tax";

  const { data: existing } = await supabase
    .from("partner_tax_profiles")
    .select(
      "id, legal_payee_name, business_dba_name, entity_classification, mailing_address, country, form_type, status, collection_source, certified_at",
    )
    .eq("partner_profile_id", profile.id)
    .maybeSingle();

  const row = {
    partner_profile_id: profile.id,
    legal_payee_name,
    business_dba_name: incoming.business_dba_name.trim() || null,
    entity_classification: incoming.entity_classification.trim() || null,
    mailing_address: mailing_address || null,
    country,
    form_type: incoming.residency === "w9" ? "w9" : "w8",
    status: taxStatus,
    collection_source:
      preferred === "quickbooks" ||
      preferred === "ach" ||
      preferred === "check"
        ? collection_source
        : existing?.collection_source === "quickbooks_w9"
          ? existing.collection_source
          : collection_source,
    certified_at: incoming.mode === "submit" ? now : existing?.certified_at ?? null,
    last_reviewed_at: now,
  };

  let taxId = existing?.id as string | undefined;
  if (taxId) {
    const { error } = await supabase
      .from("partner_tax_profiles")
      .update(row)
      .eq("id", taxId);
    if (error) return { error: partnerFacingError("Could not save your tax profile.", error.message) };
  } else {
    const { data: inserted, error } = await supabase
      .from("partner_tax_profiles")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: partnerFacingError("Could not save your tax profile.", error.message) };
    taxId = inserted.id as string;
  }

  const nonStripeReady =
    incoming.mode === "submit" &&
    (preferred === "quickbooks" ||
      preferred === "ach" ||
      preferred === "check");

  const paymentStatus =
    profile.payment_setup_status === "on_hold" ||
    profile.payout_eligibility === "on_hold"
      ? "on_hold"
      : nonStripeReady || profile.payment_setup_status === "ready"
        ? "ready"
        : "incomplete";
  const payout_eligibility = connectEligibilityFor(taxStatus, paymentStatus);

  const { error: profileError } = await supabase
    .from("partner_profiles")
    .update({
      tax_profile_status: taxStatus,
      payment_setup_status: paymentStatus,
      payout_eligibility,
    })
    .eq("id", profile.id);
  if (profileError) return { error: partnerFacingError("Could not save your tax profile.", profileError.message) };

  const audit = await writeTaxAudit(supabase, {
    actorUserId: access.user.id,
    entityType: "partner_tax_profile",
    entityId: taxId,
    action:
      incoming.mode === "submit" ? "tax_profile_submitted" : "tax_profile_draft_saved",
    previousValue: existing
      ? {
          legal_payee_name: existing.legal_payee_name,
          status: existing.status,
          form_type: existing.form_type,
        }
      : null,
    newValue: {
      legal_payee_name: row.legal_payee_name,
      status: row.status,
      form_type: row.form_type,
      country: row.country,
    },
    reason: incoming.mode === "submit" ? "Partner certified tax profile" : "Draft save",
  });
  if (audit.error) return { error: audit.error };

  revalidateTaxPaths();
  return { redirect: PARTNER_PATHS.settingsTax };
}

export async function routeTaxToReview(): Promise<ActionResult> {
  const loaded = await loadWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, access, profile } = loaded;

  const { data: existing } = await supabase
    .from("partner_tax_profiles")
    .select("id, status, form_type, legal_payee_name")
    .eq("partner_profile_id", profile.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const row = {
    partner_profile_id: profile.id,
    legal_payee_name:
      (existing?.legal_payee_name as string | null)?.trim() ||
      access.context?.company?.name ||
      "Pending review",
    form_type: existing?.form_type ?? "other",
    status: "review_required" as const,
    collection_source: "other",
    last_reviewed_at: now,
  };

  let taxId = existing?.id as string | undefined;
  if (taxId) {
    const { error } = await supabase
      .from("partner_tax_profiles")
      .update(row)
      .eq("id", taxId);
    if (error) return { error: partnerFacingError("Could not save your tax profile.", error.message) };
  } else {
    const { data: inserted, error } = await supabase
      .from("partner_tax_profiles")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: partnerFacingError("Could not save your tax profile.", error.message) };
    taxId = inserted.id as string;
  }

  const { error: profileError } = await supabase
    .from("partner_profiles")
    .update({
      tax_profile_status: "review_required",
      payout_eligibility: "needs_tax_setup",
    })
    .eq("id", profile.id);
  if (profileError) return { error: partnerFacingError("Could not save your tax profile.", profileError.message) };

  const audit = await writeTaxAudit(supabase, {
    actorUserId: access.user.id,
    entityType: "partner_tax_profile",
    entityId: taxId,
    action: "tax_profile_routed_to_review",
    previousValue: existing
      ? { status: existing.status, form_type: existing.form_type }
      : null,
    newValue: { status: "review_required" },
    reason: "Partner selected Not sure — route to review",
  });
  if (audit.error) return { error: audit.error };

  revalidateTaxPaths();
  return { redirect: PARTNER_PATHS.settingsTax };
}

export async function startSettingsStripeSetup(): Promise<ActionResult> {
  const loaded = await loadWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, access, profile } = loaded;

  const result = await beginPartnerStripeOnboarding({
    supabase,
    profile,
    actorUserId: access.user.id,
  });
  if (result.error) return { error: result.error };

  // Do not revalidate here — this action always redirects out to Stripe.
  // revalidateTaxPaths() blocks the response for minutes in dev (catch-all page).
  // Status syncs on the return/refresh routes instead.
  return { redirect: result.redirect };
}

/** Sync Connect account after return_url; used by return page. */
export async function syncSettingsStripeStatus(options?: {
  revalidate?: boolean;
}): Promise<ActionResult> {
  const loaded = await loadWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { supabase, access, profile } = loaded;

  const result = await syncPartnerStripeAccount({
    supabase,
    profile,
    actorUserId: access.user.id,
  });
  if (result.error) return { error: result.error };

  // Never call revalidatePath during RSC render (return/refresh routes).
  if (options?.revalidate !== false) {
    revalidateTaxPaths();
  }
  return { redirect: result.redirect || PARTNER_PATHS.settingsTax };
}
