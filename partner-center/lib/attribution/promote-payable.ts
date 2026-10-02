import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveAmountsForEarnings,
  loadAdjustmentsForEarnings,
} from "@/partner-center/lib/attribution/payout-amounts";
import {
  isPayableDateReached,
  parsePaymentTerms,
} from "@/partner-center/lib/attribution/payment-terms";
import {
  isNewCustomerWaitingPeriodComplete,
  parseNewCustomerPeriodDays,
  resolvePartnerReferringStartedAt,
} from "@/partner-center/lib/attribution/waiting-period";
import { resolvePayoutGate } from "@/partner-center/lib/payout-gate";

export type PromotePayableResult = {
  promotedCount: number;
  approvedFromPendingCount?: number;
  releasedFromHoldCount?: number;
  skippedReason?: string;
};

async function releaseHeldAfterWaitingPeriod(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<number> {
  const { data: held } = await supabase
    .from("partner_earnings")
    .select("id, commission_rule_id, payable_date")
    .eq("partner_profile_id", partnerProfileId)
    .eq("status", "held");

  if (!held?.length) return 0;

  const referringStartedAt = await resolvePartnerReferringStartedAt(
    supabase,
    partnerProfileId,
  );

  const ruleIds = [
    ...new Set(
      held
        .map((row) => row.commission_rule_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const periodByRuleId = new Map<string, number>();
  if (ruleIds.length > 0) {
    const { data: rules } = await supabase
      .from("partner_commission_rules")
      .select("id, eligible_revenue_rules")
      .in("id", ruleIds);
    for (const rule of rules ?? []) {
      periodByRuleId.set(
        rule.id as string,
        parseNewCustomerPeriodDays(rule.eligible_revenue_rules),
      );
    }
  }

  const releasableIds = held
    .filter((row) => {
      const periodDays =
        periodByRuleId.get(row.commission_rule_id as string) ??
        parseNewCustomerPeriodDays(null);
      return isNewCustomerWaitingPeriodComplete(
        referringStartedAt,
        periodDays,
      );
    })
    .map((row) => row.id as string);

  if (releasableIds.length === 0) return 0;

  // After waiting period → pending (system), then approve when payable date ready.
  const { error } = await supabase
    .from("partner_earnings")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .in("id", releasableIds);

  if (error) return 0;
  return releasableIds.length;
}

/** System-driven Pending → Approved once payable_date (incl. hold) is reached. */
async function approvePendingEarnings(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<number> {
  const { data: pending } = await supabase
    .from("partner_earnings")
    .select("id, payable_date")
    .eq("partner_profile_id", partnerProfileId)
    .eq("status", "pending");

  if (!pending?.length) return 0;

  const readyIds = pending
    .filter((row) =>
      isPayableDateReached((row.payable_date as string | null) ?? null),
    )
    .map((row) => row.id as string);

  if (readyIds.length === 0) return 0;

  const { error } = await supabase
    .from("partner_earnings")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .in("id", readyIds);

  if (error) return 0;
  return readyIds.length;
}

export async function promoteEarningsToPayable(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<PromotePayableResult> {
  const releasedFromHoldCount = await releaseHeldAfterWaitingPeriod(
    supabase,
    partnerProfileId,
  );
  const approvedFromPendingCount = await approvePendingEarnings(
    supabase,
    partnerProfileId,
  );

  const { data: profile, error: profileError } = await supabase
    .from("partner_profiles")
    .select(
      "id, payout_eligibility, tax_profile_status, payment_setup_status",
    )
    .eq("id", partnerProfileId)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      promotedCount: 0,
      releasedFromHoldCount,
      approvedFromPendingCount,
      skippedReason: "Partner profile not found.",
    };
  }

  const gate = resolvePayoutGate({
    payout_eligibility: profile.payout_eligibility as string,
    tax_profile_status: profile.tax_profile_status as string,
    payment_setup_status: profile.payment_setup_status as string | null,
  });

  if (gate !== "eligible") {
    return {
      promotedCount: 0,
      releasedFromHoldCount,
      approvedFromPendingCount,
      skippedReason: `Payout gate: ${gate}`,
    };
  }

  const { data: earnings, error: earningsError } = await supabase
    .from("partner_earnings")
    .select("id, amount, payable_date, status, commission_rule_id")
    .eq("partner_profile_id", partnerProfileId)
    .eq("status", "approved");

  if (earningsError || !earnings?.length) {
    return {
      promotedCount: 0,
      releasedFromHoldCount,
      approvedFromPendingCount,
    };
  }

  const candidateIds = earnings
    .filter((row) =>
      isPayableDateReached((row.payable_date as string | null) ?? null),
    )
    .map((row) => row.id as string);

  if (candidateIds.length === 0) {
    return {
      promotedCount: 0,
      releasedFromHoldCount,
      approvedFromPendingCount,
    };
  }

  const candidates = earnings.filter((row) =>
    candidateIds.includes(row.id as string),
  );
  const adjustments = await loadAdjustmentsForEarnings(supabase, candidateIds);
  const effectiveById = effectiveAmountsForEarnings(
    candidates.map((row) => ({
      id: row.id as string,
      amount: row.amount as number | string,
      status: row.status as string,
    })),
    adjustments,
  );

  const eligibleIds = candidateIds.filter(
    (id) => (effectiveById.get(id) ?? 0) > 0,
  );

  if (eligibleIds.length === 0) {
    return {
      promotedCount: 0,
      releasedFromHoldCount,
      approvedFromPendingCount,
    };
  }

  const { error: updateError } = await supabase
    .from("partner_earnings")
    .update({ status: "payable", updated_at: new Date().toISOString() })
    .in("id", eligibleIds);

  if (updateError) {
    return {
      promotedCount: 0,
      releasedFromHoldCount,
      approvedFromPendingCount,
      skippedReason: updateError.message,
    };
  }

  const { notifyPartnerEarningsPayable } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  void notifyPartnerEarningsPayable({
    admin: supabase,
    partnerProfileId,
    count: eligibleIds.length,
  }).catch((error: unknown) => {
    console.error(
      "[promoteEarningsToPayable] partner notification failed",
      partnerProfileId,
      error,
    );
  });

  return {
    promotedCount: eligibleIds.length,
    releasedFromHoldCount,
    approvedFromPendingCount,
  };
}

/**
 * Load minimum payout threshold from a locked/payable earning's rule (dollars).
 * Pass `earningIds` after locking so status is `payout_locked`, not `payable`.
 */
export async function loadMinPayoutThreshold(
  supabase: SupabaseClient,
  partnerProfileId: string,
  earningIds?: string[],
): Promise<number> {
  let query = supabase
    .from("partner_earnings")
    .select("commission_rule_id")
    .eq("partner_profile_id", partnerProfileId)
    .limit(1);

  if (earningIds?.length) {
    query = query.in("id", earningIds);
  } else {
    query = query.in("status", ["payable", "payout_locked"]);
  }

  const { data: row } = await query.maybeSingle();

  if (!row?.commission_rule_id) return 0;

  const { data: rule } = await supabase
    .from("partner_commission_rules")
    .select("payment_terms")
    .eq("id", row.commission_rule_id as string)
    .maybeSingle();

  return parsePaymentTerms(rule?.payment_terms as string | null).minPayoutDollars;
}
