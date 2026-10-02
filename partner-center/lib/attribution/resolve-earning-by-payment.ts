import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe, stripeConfigured } from "@/partner-center/lib/stripe";
import type { CommissionRuleRow } from "@/partner-center/lib/attribution/types";

export type ResolvedEarning = {
  earning: {
    id: string;
    partner_profile_id: string;
    amount: number;
    status: string;
    commission_rule_id: string;
    attribution_event_id: string;
    collected_payment_ref: string | null;
  };
  rule: CommissionRuleRow;
  originalCollectedCents: number;
};

export type ResolveEarningResult =
  | { ok: true; data: ResolvedEarning }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string };

type EarningRow = {
  id: string;
  partner_profile_id: string;
  amount: number | string;
  status: string;
  commission_rule_id: string;
  attribution_event_id: string;
  collected_payment_ref: string | null;
  collected_payment_source: string | null;
};

async function loadEarningByRef(
  supabase: SupabaseClient,
  paymentRef: string,
): Promise<EarningRow | null> {
  const { data, error } = await supabase
    .from("partner_earnings")
    .select(
      "id, partner_profile_id, amount, status, commission_rule_id, attribution_event_id, collected_payment_ref, collected_payment_source",
    )
    .eq("collected_payment_ref", paymentRef)
    .eq("collected_payment_source", "stripe")
    .maybeSingle();

  if (error) return null;
  return (data as EarningRow | null) ?? null;
}

async function resolvePaymentIntentFromCharge(
  chargeId: string,
): Promise<string | null> {
  if (!stripeConfigured()) return null;
  try {
    const charge = await getStripe().charges.retrieve(chargeId);
    const pi = charge.payment_intent;
    return typeof pi === "string" ? pi : (pi?.id ?? null);
  } catch {
    return null;
  }
}

async function loadCommissionRule(
  supabase: SupabaseClient,
  ruleId: string,
): Promise<CommissionRuleRow | null> {
  const { data } = await supabase
    .from("partner_commission_rules")
    .select(
      "id, partner_profile_id, program, rate_type, rate_value, earning_basis, eligible_period, attribution_window_days, eligible_revenue_rules, payment_terms, effective_start, effective_end",
    )
    .eq("id", ruleId)
    .maybeSingle();
  return (data as CommissionRuleRow | null) ?? null;
}

export async function resolveEarningByPaymentRef(
  supabase: SupabaseClient,
  paymentRef: string,
  opts?: { originalCollectedCents?: number },
): Promise<ResolveEarningResult> {
  const trimmed = paymentRef.trim();
  if (!trimmed) {
    return { ok: false, skipped: true, reason: "Empty payment reference." };
  }

  let earning = await loadEarningByRef(supabase, trimmed);

  if (!earning && trimmed.startsWith("ch_")) {
    const paymentIntentId = await resolvePaymentIntentFromCharge(trimmed);
    if (paymentIntentId) {
      earning = await loadEarningByRef(supabase, paymentIntentId);
    }
  }

  if (!earning) {
    return {
      ok: false,
      skipped: true,
      reason: "No partner earning linked to this payment.",
    };
  }

  const { data: event } = await supabase
    .from("partner_attribution_events")
    .select("amount_collected_cents")
    .eq("id", earning.attribution_event_id)
    .maybeSingle();

  let originalCollectedCents = opts?.originalCollectedCents;
  if (originalCollectedCents == null) {
    const stored = event?.amount_collected_cents;
    if (typeof stored === "number" && stored > 0) {
      originalCollectedCents = stored;
    }
  }

  if (
    originalCollectedCents == null &&
    stripeConfigured() &&
    (trimmed.startsWith("pi_") || trimmed.startsWith("ch_"))
  ) {
    try {
      const stripe = getStripe();
      if (trimmed.startsWith("pi_")) {
        const pi = await stripe.paymentIntents.retrieve(trimmed);
        originalCollectedCents = pi.amount_received || pi.amount;
      } else {
        const charge = await stripe.charges.retrieve(trimmed);
        originalCollectedCents = charge.amount;
      }
    } catch {
      // fall through
    }
  }

  if (!originalCollectedCents || originalCollectedCents <= 0) {
    return {
      ok: false,
      error: "Could not determine original collected amount for reversal.",
    };
  }

  const rule = await loadCommissionRule(supabase, earning.commission_rule_id);
  if (!rule) {
    return { ok: false, error: "Commission rule not found for earning." };
  }

  return {
    ok: true,
    data: {
      earning: {
        id: earning.id,
        partner_profile_id: earning.partner_profile_id,
        amount: Number(earning.amount) || 0,
        status: earning.status,
        commission_rule_id: earning.commission_rule_id,
        attribution_event_id: earning.attribution_event_id,
        collected_payment_ref: earning.collected_payment_ref,
      },
      rule,
      originalCollectedCents,
    },
  };
}
