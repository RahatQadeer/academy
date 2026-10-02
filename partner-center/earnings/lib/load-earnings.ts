import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import {
  earningBasisLabel,
  eligiblePeriodLabel,
  formatShortDate,
  programLabel,
  referralProgramLabel,
  rateDisplay,
  referralDisplayId,
  sourceTitle,
} from "@/partner-center/earnings/lib/format";
import { loadEarningSources } from "@/partner-center/earnings/lib/load-sources";
import {
  coalesceEligiblePeriod,
  coalesceEarningBasis,
  coalescePaymentTerms,
} from "@/partner-center/lib/commission-defaults";
import { resolvePayoutGate } from "@/partner-center/lib/payout-gate";
import type { LoadResult } from "@/partner-center/lib/load-result";
import type { PartnerContext } from "@/partner-center/types/partner";
import {
  effectiveAmountForRow,
  mapAdjustmentsByEarningId,
  sumEarningsWithAdjustments,
} from "@/partner-center/earnings/lib/sum-earnings";
import {
  matchesStatusFilter,
  type EarningsListItem,
  type EarningsOverview,
  type EarningsStatusFilter,
  type PaymentTermsSummary,
  type ProgramRateRow,
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

type EarningDateRow = {
  status: string;
  payable_date: string | null;
};

function pickRule(rows: RuleRow[], program: string, profileId: string) {
  return (
    rows.find(
      (row) => row.program === program && row.partner_profile_id === profileId,
    ) ?? rows.find((row) => row.program === program && !row.partner_profile_id)
  );
}

function scheduleFallbackLabel() {
  return "On schedule";
}

/** Soonest payable date among open earnings; else ready / on schedule. */
function nextPayoutLabel(earningRows: EarningDateRow[]): string {
  const candidates = earningRows
    .filter(
      (row) =>
        row.status === "payable" ||
        row.status === "approved" ||
        row.status === "pending",
    )
    .map((row) => row.payable_date)
    .filter((value): value is string => Boolean(value?.trim()))
    .sort();

  if (earningRows.some((row) => row.status === "payable")) {
    return candidates[0] ? formatShortDate(candidates[0]) : "Ready now";
  }
  if (candidates[0]) return formatShortDate(candidates[0]);
  return scheduleFallbackLabel();
}

function paymentTermsFromRules(
  rows: RuleRow[],
  profileId: string,
  earningRows: EarningDateRow[],
): PaymentTermsSummary {
  const academy = pickRule(rows, "academy", profileId);
  const platform = pickRule(rows, "platform", profileId);
  const enterprise = pickRule(rows, "enterprise", profileId);
  const schedule = coalescePaymentTerms(
    academy?.payment_terms ||
      platform?.payment_terms ||
      enterprise?.payment_terms,
  );
  const period = coalesceEligiblePeriod(
    academy?.eligible_period ||
      platform?.eligible_period ||
      enterprise?.eligible_period,
  );
  return {
    schedule,
    eligiblePeriod: eligiblePeriodLabel(period),
    nextPayout: nextPayoutLabel(earningRows),
  };
}

export async function loadEarnings(
  context: PartnerContext | null,
  statusFilter: EarningsStatusFilter,
): Promise<LoadResult<EarningsOverview>> {
  const profile = context?.profile;
  if (!profile || !isSupabaseConfigured()) {
    return { ok: false, error: "Earnings could not be loaded." };
  }

  const supabase = await createClient();
  const profileId = profile.id;

  const [earningsRes, payoutsRes, programsRes, rulesRes] = await Promise.all([
    supabase
      .from("partner_earnings")
      .select(
        "id, amount, status, commission_rule_id, attribution_event_id, payable_date, created_at",
      )
      .eq("partner_profile_id", profileId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_payouts")
      .select("id, status")
      .eq("partner_profile_id", profileId),
    supabase
      .from("partner_programs")
      .select("program, active")
      .eq("partner_profile_id", profileId),
    supabase
      .from("partner_commission_rules")
      .select(
        "id, partner_profile_id, program, rate_type, rate_value, earning_basis, eligible_period, payment_terms",
      )
      .or(`partner_profile_id.eq.${profileId},partner_profile_id.is.null`),
  ]);

  if (earningsRes.error) {
    return { ok: false, error: "Earnings could not be loaded." };
  }
  if (payoutsRes.error) {
    return { ok: false, error: "Earnings could not be loaded." };
  }

  const earningRows = earningsRes.data ?? [];
  const earningIds = earningRows.map((row) => row.id as string);

  let adjustmentsByEarningId = new Map<
    string,
    { amount_delta: number | string }[]
  >();
  if (earningIds.length > 0) {
    const { data: adjustmentRows, error: adjustmentsError } = await supabase
      .from("partner_earning_adjustments")
      .select("earning_id, amount_delta")
      .in("earning_id", earningIds);
    if (adjustmentsError) {
      return { ok: false, error: "Earnings could not be loaded." };
    }
    adjustmentsByEarningId = mapAdjustmentsByEarningId(
      (adjustmentRows ?? []) as { earning_id: string; amount_delta: number | string }[],
    );
  }

  const rowsForSum = earningRows.map((row) => ({
    id: row.id as string,
    amount: row.amount as number | string,
    status: row.status as string,
  }));
  const totals = sumEarningsWithAdjustments(rowsForSum, adjustmentsByEarningId);
  const paidPayoutCount = (payoutsRes.data ?? []).filter(
    (row) => row.status === "paid",
  ).length;
  const rules = (rulesRes.data ?? []) as RuleRow[];
  const payoutGate = resolvePayoutGate(profile);

  const programActive = new Map<string, boolean>();
  for (const row of programsRes.data ?? []) {
    programActive.set(row.program as string, Boolean(row.active));
  }

  // §17.4.5 / §17.11.5 — always surface configured rates from rules; enrollment
  // is reflected by active styling, not by replacing the rate with "Inactive".
  const programs: ProgramRateRow[] = (
    ["academy", "platform", "enterprise"] as const
  ).map((key) => {
    const rule = pickRule(rules, key, profileId);
    const active = programActive.get(key) === true;
    return {
      key,
      label: programLabel(key),
      active,
      rateLabel: rateDisplay(rule?.rate_type, rule?.rate_value),
    };
  });

  const eventIds = [
    ...new Set(
      earningRows
        .map((row) => row.attribution_event_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const eventById = new Map<
    string,
    { referral_id: string | null; opportunity_id: string | null; product: string | null }
  >();

  if (eventIds.length > 0) {
    const { data: events } = await supabase
      .from("partner_attribution_events")
      .select("id, referral_id, opportunity_id, product")
      .in("id", eventIds);
    for (const event of events ?? []) {
      eventById.set(event.id as string, {
        referral_id: (event.referral_id as string | null) ?? null,
        opportunity_id: (event.opportunity_id as string | null) ?? null,
        product: (event.product as string | null) ?? null,
      });
    }
  }

  const referralIds = [
    ...new Set(
      [...eventById.values()]
        .map((event) => event.referral_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const opportunityIds = [
    ...new Set(
      [...eventById.values()]
        .map((event) => event.opportunity_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const sources = await loadEarningSources(supabase, referralIds, opportunityIds);
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

  const allItems: EarningsListItem[] = earningRows.map((row) => {
    const event = eventById.get(row.attribution_event_id as string);
    const referral = event?.referral_id
      ? sources.referrals.get(event.referral_id)
      : undefined;
    const opportunity = event?.opportunity_id
      ? sources.opportunities.get(event.opportunity_id)
      : undefined;
    const program =
      referral?.program ||
      (event?.opportunity_id ? "enterprise" : null) ||
      event?.product ||
      null;
    const name =
      referral?.companyName ||
      referral?.contactName ||
      opportunity?.companyName ||
      referral?.product ||
      event?.product ||
      null;
    const rule =
      ruleById.get(row.commission_rule_id as string) ??
      (program ? pickRule(rules, program, profileId) : undefined);
    const displaySourceId =
      event?.referral_id || event?.opportunity_id || (row.id as string);

    return {
      id: row.id as string,
      displayId: referralDisplayId(displaySourceId),
      sourceLabel: sourceTitle(name, program),
      programLabel: program ? referralProgramLabel(program) : "—",
      basisLabel: earningBasisLabel(coalesceEarningBasis(rule?.earning_basis)),
      rateLabel: rateDisplay(rule?.rate_type, rule?.rate_value),
      amount: effectiveAmountForRow(
        {
          id: row.id as string,
          amount: row.amount as number | string,
          status: row.status as string,
        },
        adjustmentsByEarningId,
      ),
      status: row.status as string,
    };
  });

  return {
    ok: true,
    data: {
      totals,
      paidPayoutCount,
      payoutGate,
      programs,
      paymentTerms: paymentTermsFromRules(
        rules,
        profileId,
        earningRows.map((row) => ({
          status: row.status as string,
          payable_date: (row.payable_date as string | null) ?? null,
        })),
      ),
      items: allItems.filter((item) =>
        matchesStatusFilter(item.status, statusFilter),
      ),
      isEmpty: allItems.every((item) => item.status === "ineligible"),
      statusFilter,
    },
  };
}
