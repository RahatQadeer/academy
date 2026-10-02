import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isEligibleOpportunityStatus,
  isWithinProtectionPeriod,
} from "@/partner-center/lib/attribution/opportunity-payment-eligibility";

export type ResolvedOpportunityForPayment = {
  opportunityId: string;
  partnerProfileId: string;
};

type OpportunityRow = {
  id: string;
  partner_profile_id: string;
  status: string;
  protected_until: string | null;
};

function isEligibleRow(
  row: OpportunityRow,
  eventTime: Date,
): row is OpportunityRow & { status: string } {
  return (
    isEligibleOpportunityStatus(row.status) &&
    isWithinProtectionPeriod(row.protected_until, eventTime)
  );
}

export async function resolveOpportunityForPayment(
  supabase: SupabaseClient,
  input: {
    opportunityId?: string | null;
    billingEmail?: string | null;
    eventTime: Date;
  },
): Promise<ResolvedOpportunityForPayment | null> {
  const eventTime = input.eventTime;

  if (input.opportunityId?.trim()) {
    const { data: row } = await supabase
      .from("partner_opportunities")
      .select("id, partner_profile_id, status, protected_until")
      .eq("id", input.opportunityId.trim())
      .maybeSingle();

    if (row && isEligibleRow(row as OpportunityRow, eventTime)) {
      return {
        opportunityId: row.id as string,
        partnerProfileId: row.partner_profile_id as string,
      };
    }
    return null;
  }

  const email = input.billingEmail?.trim().toLowerCase();
  if (!email) return null;

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", email);

  const contactIds = (contacts ?? []).map((row) => row.id as string);
  if (contactIds.length === 0) return null;

  const { data: opportunities } = await supabase
    .from("partner_opportunities")
    .select("id, partner_profile_id, status, protected_until")
    .in("primary_contact_id", contactIds);

  const eligible = (opportunities ?? []).filter((row) =>
    isEligibleRow(row as OpportunityRow, eventTime),
  ) as OpportunityRow[];

  if (eligible.length !== 1) return null;

  return {
    opportunityId: eligible[0].id,
    partnerProfileId: eligible[0].partner_profile_id,
  };
}
