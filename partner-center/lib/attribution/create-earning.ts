import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCommissionAmount } from "@/partner-center/lib/attribution/commission-math";
import {
  checkEarningBasisAndPeriod,
  daysBetween,
} from "@/partner-center/lib/attribution/earning-eligibility";
import {
  netEligibleCollectedCents,
  parseEligibleRevenueRules,
} from "@/partner-center/lib/attribution/eligible-revenue";
import {
  derivePayableDate,
  isPayableDateReached,
  parsePaymentTerms,
} from "@/partner-center/lib/attribution/payment-terms";
import { loadCommissionRules } from "@/partner-center/lib/attribution/pick-commission-rule";
import { promoteEarningsToPayable } from "@/partner-center/lib/attribution/promote-payable";
import { resolveGoverningTerms } from "@/partner-center/lib/attribution/resolve-governing-terms";
import type { CommissionProgram } from "@/partner-center/lib/attribution/types";
import {
  isNewCustomerWaitingPeriodComplete,
  parseNewCustomerPeriodDays,
  resolvePartnerReferringStartedAt,
  waitingPeriodEndsAt,
} from "@/partner-center/lib/attribution/waiting-period";
import { isPartnerProgramActive } from "@/partner-center/lib/enable-programs";

export type CreateEarningResult = {
  ok: boolean;
  error?: string;
  earningId?: string;
  skipped?: boolean;
  heldForWaitingPeriod?: boolean;
  ineligible?: boolean;
  /** True when rejected because the partner's program is not active. */
  programInactive?: boolean;
};

async function countPriorCommissionableEarnings(
  supabase: SupabaseClient,
  input: {
    partnerProfileId: string;
    referralId: string | null;
    opportunityId: string | null;
  },
): Promise<number> {
  let eventQuery = supabase
    .from("partner_attribution_events")
    .select("id")
    .eq("partner_profile_id", input.partnerProfileId);

  if (input.referralId) {
    eventQuery = eventQuery.eq("referral_id", input.referralId);
  } else if (input.opportunityId) {
    eventQuery = eventQuery.eq("opportunity_id", input.opportunityId);
  } else {
    return 0;
  }

  const { data: events } = await eventQuery;
  const eventIds = (events ?? []).map((row) => row.id as string);
  if (eventIds.length === 0) return 0;

  const { data: earnings } = await supabase
    .from("partner_earnings")
    .select("id, status")
    .in("attribution_event_id", eventIds)
    .not("status", "in", '("ineligible","reversed")');

  return (earnings ?? []).length;
}

async function skipIneligibleEarning(): Promise<CreateEarningResult> {
  // Do not persist $0 / ineligible rows — partners should not see noise in earnings.
  return {
    ok: true,
    ineligible: true,
    skipped: true,
  };
}

export async function createEarningFromEvent(
  supabase: SupabaseClient,
  eventId: string,
  options?: { amountCollectedCents?: number; program?: CommissionProgram },
): Promise<CreateEarningResult> {
  const { data: event, error: eventError } = await supabase
    .from("partner_attribution_events")
    .select(
      "id, partner_profile_id, referral_id, opportunity_id, product, event_source, external_payment_id, event_timestamp",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event?.id) {
    return { ok: false, error: "Attribution event not found." };
  }

  const { data: existing } = await supabase
    .from("partner_earnings")
    .select("id")
    .eq("attribution_event_id", eventId)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, earningId: existing.id as string, skipped: true };
  }

  let program = options?.program;
  if (!program && event.opportunity_id) {
    program = "enterprise";
  }
  if (!program && event.referral_id) {
    const { data: referral } = await supabase
      .from("partner_referrals")
      .select("program")
      .eq("id", event.referral_id as string)
      .maybeSingle();
    if (referral?.program === "whitbyos" || referral?.program === "academy") {
      program =
        referral.program === "whitbyos"
          ? "platform"
          : (referral.program as CommissionProgram);
    }
  }
  if (!program) {
    const eventProduct = event.product as string;
    if (eventProduct === "whitbyos") {
      program = "platform";
    } else {
      program =
        eventProduct === "platform" ||
        eventProduct === "academy" ||
        eventProduct === "enterprise"
          ? (eventProduct as CommissionProgram)
          : "academy";
    }
  }
  const profileId = event.partner_profile_id as string;
  const governing = await resolveGoverningTerms(supabase, profileId);

  const programActive = await isPartnerProgramActive(
    supabase,
    profileId,
    program,
  );
  if (!programActive) {
    const error = `Partner program "${program}" is not enabled — earning was not created.`;
    console.error("[partner-earnings] program inactive", {
      partnerProfileId: profileId,
      program,
      eventId,
      externalPaymentId: event.external_payment_id,
      eventSource: event.event_source,
    });
    return { ok: false, error, programInactive: true };
  }

  const rule = await loadCommissionRules(supabase, profileId, program);
  if (!rule) {
    return { ok: false, error: "No commission rule configured for this program." };
  }

  const eventTime = new Date(
    (event.event_timestamp as string) || new Date().toISOString(),
  );

  let conversionDateIso: string | null = null;
  if (event.referral_id) {
    const { data: referral } = await supabase
      .from("partner_referrals")
      .select("conversion_event_date, referral_date")
      .eq("id", event.referral_id as string)
      .maybeSingle();
    conversionDateIso =
      (referral?.conversion_event_date as string | null) ||
      (referral?.referral_date as string | null) ||
      null;
  } else if (event.opportunity_id) {
    const { data: opportunity } = await supabase
      .from("partner_opportunities")
      .select("accepted_at, created_at")
      .eq("id", event.opportunity_id as string)
      .maybeSingle();
    conversionDateIso =
      (opportunity?.accepted_at as string | null) ||
      (opportunity?.created_at as string | null) ||
      null;
  }

  const priorCount = await countPriorCommissionableEarnings(supabase, {
    partnerProfileId: profileId,
    referralId: (event.referral_id as string | null) ?? null,
    opportunityId: (event.opportunity_id as string | null) ?? null,
  });

  const daysSinceConversion = conversionDateIso
    ? daysBetween(conversionDateIso, eventTime)
    : 0;

  const basisCheck = checkEarningBasisAndPeriod({
    basis: rule.earning_basis,
    eligiblePeriod: rule.eligible_period,
    priorCommissionableCount: priorCount,
    daysSinceConversion,
  });

  if (!basisCheck.ok) {
    return skipIneligibleEarning();
  }

  const revenueRules = parseEligibleRevenueRules(rule.eligible_revenue_rules);
  const netCents = netEligibleCollectedCents(
    options?.amountCollectedCents,
    revenueRules,
  );

  const amount = computeCommissionAmount(
    rule,
    netCents ?? options?.amountCollectedCents,
  );
  if (amount == null || amount <= 0) {
    return skipIneligibleEarning();
  }

  const waitingPeriodDays = parseNewCustomerPeriodDays(
    rule.eligible_revenue_rules,
  );
  const referringStartedAt = await resolvePartnerReferringStartedAt(
    supabase,
    profileId,
  );
  const waitingComplete = isNewCustomerWaitingPeriodComplete(
    referringStartedAt,
    waitingPeriodDays,
    eventTime,
  );

  // §17.7.7 — Pending → Approved (system); Held during §17.1.12 waiting period.
  const status = waitingComplete ? "pending" : "held";

  let payableDate = derivePayableDate(rule.payment_terms, eventTime);
  if (!waitingComplete && referringStartedAt) {
    const waitEnd = waitingPeriodEndsAt(referringStartedAt, waitingPeriodDays);
    const termsPayable = Date.parse(`${payableDate}T00:00:00.000Z`);
    const waitEndMs = waitEnd.getTime();
    if (Number.isNaN(termsPayable) || waitEndMs > termsPayable) {
      payableDate = waitEnd.toISOString().slice(0, 10);
    }
  }

  const { data: created, error: insertError } = await supabase
    .from("partner_earnings")
    .insert({
      attribution_event_id: eventId,
      partner_profile_id: profileId,
      commission_rule_id: rule.id,
      amount,
      status,
      collected_payment_source: event.event_source,
      collected_payment_ref: event.external_payment_id,
      payable_date: payableDate,
      governing_document_id: governing.documentId,
      terms_version: governing.termsVersion,
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    return {
      ok: false,
      error: insertError?.message ?? "Could not create earning.",
    };
  }

  if (waitingComplete) {
    try {
      await promoteEarningsToPayable(supabase, profileId);
    } catch (error) {
      // Earning row is already saved — promote failure must not unwind callers
      // that still need to mark the referral converted (SRS §17.5.14).
      console.error(
        "[partner-earnings] promote after insert failed",
        profileId,
        error,
      );
    }
  }

  return {
    ok: true,
    earningId: created.id as string,
    heldForWaitingPeriod: !waitingComplete,
  };
}

/** @deprecated use parsePaymentTerms().minPayoutDollars */
export function minPayoutFromRule(paymentTerms: string | null | undefined) {
  return parsePaymentTerms(paymentTerms).minPayoutDollars;
}

export { isPayableDateReached };
