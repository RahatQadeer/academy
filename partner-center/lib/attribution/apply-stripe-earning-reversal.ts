import type { SupabaseClient } from "@supabase/supabase-js";
import { sumAdjustmentDeltas } from "@/partner-center/lib/attribution/effective-amount";
import {
  computeReversalDelta,
  effectiveEarningAmount,
  isFullReversal,
} from "@/partner-center/lib/attribution/reversal-math";
import { resolveEarningByPaymentRef } from "@/partner-center/lib/attribution/resolve-earning-by-payment";

export type StripeEarningReversalInput = {
  paymentRef: string;
  type: "refund" | "chargeback";
  refundCents: number;
  originalCollectedCents?: number;
  externalRef: string;
  reason?: string;
};

export type StripeEarningReversalResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  earningId?: string;
  adjustmentId?: string;
  amountDelta?: number;
};

export async function applyStripeEarningReversal(
  supabase: SupabaseClient,
  input: StripeEarningReversalInput,
): Promise<StripeEarningReversalResult> {
  const externalRef = input.externalRef.trim();
  if (!externalRef) {
    return { ok: false, error: "externalRef is required for idempotency." };
  }

  const resolved = await resolveEarningByPaymentRef(supabase, input.paymentRef, {
    originalCollectedCents: input.originalCollectedCents,
  });

  if (!resolved.ok) {
    if ("skipped" in resolved && resolved.skipped) {
      return { ok: true, skipped: true, reason: resolved.reason };
    }
    return { ok: false, error: "error" in resolved ? resolved.error : "Unknown error." };
  }

  const { earning, originalCollectedCents } = resolved.data;
  const earningId = earning.id;

  const { data: existingByRef } = await supabase
    .from("partner_earning_adjustments")
    .select("id")
    .eq("earning_id", earningId)
    .eq("external_ref", externalRef)
    .maybeSingle();

  if (existingByRef?.id) {
    return {
      ok: true,
      skipped: true,
      reason: "Duplicate external reference.",
      earningId,
    };
  }

  const { data: existingAdjustments } = await supabase
    .from("partner_earning_adjustments")
    .select("amount_delta")
    .eq("earning_id", earningId);

  const existingTotal = sumAdjustmentDeltas(existingAdjustments ?? []);

  if (earning.status === "reversed" && isFullReversal(input.refundCents, originalCollectedCents)) {
    return {
      ok: true,
      skipped: true,
      reason: "Earning already fully reversed.",
      earningId,
    };
  }

  const amountDelta = computeReversalDelta(
    earning.amount,
    input.refundCents,
    originalCollectedCents,
    existingTotal,
  );

  if (amountDelta === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "No incremental reversal needed.",
      earningId,
    };
  }

  const { data: adjustment, error: insertError } = await supabase
    .from("partner_earning_adjustments")
    .insert({
      earning_id: earningId,
      type: input.type,
      amount_delta: amountDelta,
      reason: input.reason ?? null,
      external_ref: externalRef,
    })
    .select("id")
    .single();

  if (insertError || !adjustment?.id) {
    return {
      ok: false,
      error: insertError?.message ?? "Could not record earning adjustment.",
      earningId,
    };
  }

  const full = isFullReversal(input.refundCents, originalCollectedCents);
  const newEffective = effectiveEarningAmount(earning.amount, existingTotal + amountDelta);
  const now = new Date().toISOString();

  if (earning.status === "paid") {
    return {
      ok: true,
      earningId,
      adjustmentId: adjustment.id as string,
      amountDelta,
    };
  }

  if (full && ["approved", "payable", "held", "payout_locked"].includes(earning.status)) {
    await supabase
      .from("partner_earnings")
      .update({ status: "reversed", updated_at: now })
      .eq("id", earningId);
  } else if (
    (earning.status === "payable" || earning.status === "payout_locked") &&
    newEffective <= 0
  ) {
    await supabase
      .from("partner_earnings")
      .update({ status: "approved", updated_at: now })
      .eq("id", earningId);
  } else if (full) {
    await supabase
      .from("partner_earnings")
      .update({ status: "reversed", updated_at: now })
      .eq("id", earningId);
  }

  return {
    ok: true,
    earningId,
    adjustmentId: adjustment.id as string,
    amountDelta,
  };
}
