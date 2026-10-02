import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import {
  collectedAmountLabel,
  earningBasisLabel,
  eligiblePeriodLabel,
  paymentSourceLabel,
  referralProgramLabel,
  rateOfRevenueLabel,
  referralDisplayId,
  sourceTitle,
} from "@/partner-center/earnings/lib/format";
import { loadEarningSources } from "@/partner-center/earnings/lib/load-sources";
import {
  effectiveAmountForRow,
  mapAdjustmentsByEarningId,
} from "@/partner-center/earnings/lib/sum-earnings";
import {
  paymentSetupField,
  taxProfileField,
} from "@/partner-center/earnings/lib/payout-status";
import {
  coalesceEligiblePeriod,
  coalesceEarningBasis,
  coalescePaymentTerms,
} from "@/partner-center/lib/commission-defaults";
import { resolvePayoutGate } from "@/partner-center/lib/payout-gate";
import type { PartnerContext } from "@/partner-center/types/partner";
import type {
  AdjustmentRow,
  CollectedPaymentRow,
  EarningLedger,
} from "@/partner-center/earnings/types";

type RuleRow = {
  id: string;
  partner_profile_id: string | null;
  program: string;
  rate_type: string;
  rate_value: number | string;
  earning_basis: string | null;
  eligible_period: string | null;
  payment_terms: string | null;
};

function pickRule(rows: RuleRow[], program: string, profileId: string) {
  return (
    rows.find(
      (row) => row.program === program && row.partner_profile_id === profileId,
    ) ?? rows.find((row) => row.program === program && !row.partner_profile_id)
  );
}

function formatPaymentDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function loadEarningDetail(
  context: PartnerContext | null,
  earningId: string,
): Promise<EarningLedger | null> {
  const profile = context?.profile;
  if (!profile || !isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const profileId = profile.id;

  const { data: row, error } = await supabase
    .from("partner_earnings")
    .select(
      "id, amount, status, commission_rule_id, attribution_event_id, collected_payment_source, collected_payment_ref, payable_date, created_at",
    )
    .eq("partner_profile_id", profileId)
    .eq("id", earningId)
    .maybeSingle();

  if (error || !row) return null;

  const { data: event } = await supabase
    .from("partner_attribution_events")
    .select("id, referral_id, opportunity_id, product")
    .eq("id", row.attribution_event_id as string)
    .maybeSingle();

  const referralId = (event?.referral_id as string | null) ?? null;
  const opportunityId = (event?.opportunity_id as string | null) ?? null;

  let siblingEventIds: string[] = [row.attribution_event_id as string];
  if (referralId || opportunityId) {
    let siblingQuery = supabase
      .from("partner_attribution_events")
      .select("id")
      .eq("partner_profile_id", profileId);
    if (referralId) siblingQuery = siblingQuery.eq("referral_id", referralId);
    else siblingQuery = siblingQuery.eq("opportunity_id", opportunityId);
    const { data: siblingEvents } = await siblingQuery;
    siblingEventIds = (siblingEvents ?? []).map((item) => item.id as string);
  }

  const [{ data: siblingEarnings }, { data: rules }] = await Promise.all([
    supabase
      .from("partner_earnings")
      .select(
        "id, amount, status, commission_rule_id, collected_payment_source, collected_payment_ref, payable_date, created_at",
      )
      .eq("partner_profile_id", profileId)
      .in("attribution_event_id", siblingEventIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_commission_rules")
      .select(
        "id, partner_profile_id, program, rate_type, rate_value, earning_basis, eligible_period, payment_terms",
      )
      .or(`partner_profile_id.eq.${profileId},partner_profile_id.is.null`),
  ]);

  const sources = await loadEarningSources(
    supabase,
    referralId ? [referralId] : [],
    opportunityId ? [opportunityId] : [],
  );

  const referral = referralId ? sources.referrals.get(referralId) : undefined;
  const opportunity = opportunityId
    ? sources.opportunities.get(opportunityId)
    : undefined;
  const program =
    referral?.program ||
    (opportunityId ? "enterprise" : null) ||
    (event?.product as string | null) ||
    null;
  const name =
    referral?.companyName ||
    referral?.contactName ||
    opportunity?.companyName ||
    referral?.product ||
    (event?.product as string | null) ||
    null;

  const ruleRows = (rules ?? []) as RuleRow[];
  const ruleById = new Map(ruleRows.map((rule) => [rule.id, rule]));
  const rule =
    ruleById.get(row.commission_rule_id as string) ??
    (program ? pickRule(ruleRows, program, profileId) : undefined);

  const siblingIds = (siblingEarnings ?? []).map((item) => item.id as string);
  const allEarningIds = [...new Set([...siblingIds, row.id as string])];

  const { data: adjustmentRows } = await supabase
    .from("partner_earning_adjustments")
    .select("id, earning_id, type, amount_delta, reason, created_at")
    .in("earning_id", allEarningIds)
    .order("created_at", { ascending: false });

  const adjustmentsByEarningId = mapAdjustmentsByEarningId(
    (adjustmentRows ?? []).map((item) => ({
      earning_id: item.earning_id as string,
      amount_delta: item.amount_delta as number | string,
    })),
  );

  const payments: CollectedPaymentRow[] = (siblingEarnings ?? [])
    .filter((earning) => {
      const status = (earning.status as string) || "";
      const amount = Number(earning.amount) || 0;
      // Hide $0 ineligible noise — only real commissionable payments belong here.
      if (status === "ineligible" || status === "reversed") return false;
      if (amount <= 0) return false;
      return true;
    })
    .map((earning) => {
      const siblingRule =
        ruleById.get(earning.commission_rule_id as string) ?? rule;
      const baseAmount = Number(earning.amount) || 0;
      const effective = effectiveAmountForRow(
        {
          id: earning.id as string,
          amount: earning.amount as number | string,
          status: earning.status as string,
        },
        adjustmentsByEarningId,
      );
      return {
        id: earning.id as string,
        dateLabel: formatPaymentDate(
          (earning.payable_date as string | null) ||
            (earning.created_at as string),
        ),
        collectedLabel: collectedAmountLabel(
          baseAmount,
          siblingRule?.rate_type,
          siblingRule?.rate_value,
        ),
        commission: effective,
        status: earning.status as string,
      };
    });

  const adjustments: AdjustmentRow[] = (adjustmentRows ?? [])
    .filter((item) => (item.earning_id as string) === (row.id as string))
    .map((item) => ({
      id: item.id as string,
      dateLabel: formatPaymentDate(item.created_at as string),
      type: item.type as string,
      amountDelta: Number(item.amount_delta) || 0,
      reason: (item.reason as string | null) ?? null,
    }));

  const totalEarned = effectiveAmountForRow(
    {
      id: row.id as string,
      amount: row.amount as number | string,
      status: row.status as string,
    },
    adjustmentsByEarningId,
  );
  const displaySourceId = referralId || opportunityId || (row.id as string);

  return {
    id: row.id as string,
    displayId: referralDisplayId(displaySourceId),
    title: sourceTitle(name, program),
    status: row.status as string,
    totalEarned,
    programLabel: program ? referralProgramLabel(program) : "—",
    rateLabel: rateOfRevenueLabel(rule?.rate_type, rule?.rate_value),
    basisLabel: earningBasisLabel(coalesceEarningBasis(rule?.earning_basis)),
    eligiblePeriod: eligiblePeriodLabel(
      coalesceEligiblePeriod(rule?.eligible_period),
    ),
    paymentTerms: coalescePaymentTerms(rule?.payment_terms),
    sourceLabel: paymentSourceLabel(
      row.collected_payment_source as string | null,
      row.collected_payment_ref as string | null,
    ),
    payments,
    adjustments,
    payoutGate: resolvePayoutGate(profile),
    taxProfile: taxProfileField(profile.tax_profile_status),
    paymentSetup: paymentSetupField(profile.payment_setup_status),
  };
}
