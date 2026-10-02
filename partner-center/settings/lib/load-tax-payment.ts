import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { PartnerAccess } from "@/partner-center/lib/access";
import { refreshStalePartnerStripeStatus } from "@/partner-center/lib/stripe-connect";
import type {
  PartnerPayoutEligibility,
  PartnerTaxStatus,
} from "@/partner-center/types/partner";

export type TaxProfileRow = {
  id: string;
  legal_payee_name: string | null;
  business_dba_name: string | null;
  entity_classification: string | null;
  mailing_address: string | null;
  country: string | null;
  tin_last4: string | null;
  form_type: string | null;
  status: string | null;
  collection_source: string | null;
  external_record_id: string | null;
  certified_at: string | null;
  last_reviewed_at: string | null;
};

export type TaxPaymentView = {
  companyName: string;
  taxStatus: PartnerTaxStatus | string;
  paymentSetupStatus: string;
  payoutEligibility: PartnerPayoutEligibility | string;
  preferredPayoutMethod: string | null;
  tax: TaxProfileRow | null;
  /** Restricted document id if a tax cert exists for download. */
  taxDocumentId: string | null;
};

function asTaxStatus(value: string | null | undefined): PartnerTaxStatus | string {
  return value || "not_started";
}

export async function loadTaxPayment(
  access: PartnerAccess,
): Promise<TaxPaymentView> {
  const initial = access.context?.profile ?? null;
  const companyName =
    access.context?.company?.name?.trim() || "Your company";

  const empty: TaxPaymentView = {
    companyName,
    taxStatus: asTaxStatus(initial?.tax_profile_status),
    paymentSetupStatus: (initial?.payment_setup_status || "not_started").toLowerCase(),
    payoutEligibility: initial?.payout_eligibility || "needs_tax_setup",
    preferredPayoutMethod: initial?.preferred_payout_method ?? null,
    tax: null,
    taxDocumentId: null,
  };

  if (!initial?.id || !isSupabaseConfigured() || access.user.id === "preview") {
    return empty;
  }

  const supabase = await createClient();
  const profile = await refreshStalePartnerStripeStatus({
    supabase,
    profile: initial,
    actorUserId: access.user.id,
  });

  const { data: taxRow } = await supabase
    .from("partner_tax_profiles")
    .select(
      "id, legal_payee_name, business_dba_name, entity_classification, mailing_address, country, tin_last4, form_type, status, collection_source, external_record_id, certified_at, last_reviewed_at",
    )
    .eq("partner_profile_id", profile.id)
    .maybeSingle();

  let taxDocumentId: string | null = null;
  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("context_type", "partner_profile")
    .eq("context_id", profile.id)
    .eq("visibility", "restricted")
    .order("created_at", { ascending: false })
    .limit(20);

  if (docs?.length) {
    const ids = docs.map((row) => row.id as string);
    const { data: meta } = await supabase
      .from("partner_document_meta")
      .select("document_id")
      .in("document_id", ids)
      .eq("document_kind", "tax")
      .limit(1);
    taxDocumentId = (meta?.[0]?.document_id as string | undefined) ?? null;
  }

  return {
    companyName,
    taxStatus: asTaxStatus(profile.tax_profile_status),
    paymentSetupStatus: (profile.payment_setup_status || "not_started").toLowerCase(),
    payoutEligibility: profile.payout_eligibility || "needs_tax_setup",
    preferredPayoutMethod: profile.preferred_payout_method ?? null,
    tax: taxRow
      ? {
          id: taxRow.id as string,
          legal_payee_name: (taxRow.legal_payee_name as string | null) ?? null,
          business_dba_name: (taxRow.business_dba_name as string | null) ?? null,
          entity_classification:
            (taxRow.entity_classification as string | null) ?? null,
          mailing_address: (taxRow.mailing_address as string | null) ?? null,
          country: (taxRow.country as string | null) ?? null,
          tin_last4: (taxRow.tin_last4 as string | null) ?? null,
          form_type: (taxRow.form_type as string | null) ?? null,
          status: (taxRow.status as string | null) ?? null,
          collection_source: (taxRow.collection_source as string | null) ?? null,
          external_record_id:
            (taxRow.external_record_id as string | null) ?? null,
          certified_at: (taxRow.certified_at as string | null) ?? null,
          last_reviewed_at: (taxRow.last_reviewed_at as string | null) ?? null,
        }
      : null,
    taxDocumentId,
  };
}
