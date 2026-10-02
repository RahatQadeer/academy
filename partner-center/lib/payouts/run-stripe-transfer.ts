import "server-only";

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePayoutGate } from "@/partner-center/lib/payout-gate";
import {
  effectiveAmountsForEarnings,
  loadAdjustmentsForEarnings,
  loadPendingClawbacksForPartner,
  markClawbacksApplied,
} from "@/partner-center/lib/attribution/payout-amounts";
import { loadMinPayoutThreshold } from "@/partner-center/lib/attribution/promote-payable";
import {
  PAYOUT_LOCK_STATUS,
  releasePayoutLockedEarnings,
} from "@/partner-center/lib/payouts/payout-lock";
import {
  getStripe,
  stripeConfigured,
  stripeErrorMessage,
} from "@/partner-center/lib/stripe";
import type { RunStripePayoutResult } from "@/partner-center/lib/payouts/types";
import { loadPlatformTaxConfig } from "@/super-admin/partner-center/services/platform-tax-config";

function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

function payoutIdempotencyKey(
  partnerProfileId: string,
  earningIds: string[],
  destinationAccountId: string,
  amountCents: number,
) {
  const sorted = [...earningIds].sort().join(",");
  const material = `${sorted}|${destinationAccountId}|${amountCents}`;
  const hash = createHash("sha256").update(material).digest("hex").slice(0, 32);
  return `pc-payout-${partnerProfileId}-${hash}`;
}

export async function runStripePayoutForPartner(
  supabase: SupabaseClient,
  partnerProfileId: string,
): Promise<RunStripePayoutResult> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Stripe is not configured." };
  }

  const platform = await loadPlatformTaxConfig(supabase);
  if (!platform.availablePayoutMethods.includes("stripe_connect")) {
    return {
      ok: false,
      error:
        "Stripe Connect is not an enabled payout method. Enable it in Program config first.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("partner_profiles")
    .select(
      "id, stripe_connect_account_id, payout_eligibility, tax_profile_status, payment_setup_status",
    )
    .eq("id", partnerProfileId)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, error: "Partner profile not found." };
  }

  const gate = resolvePayoutGate({
    payout_eligibility: profile.payout_eligibility as string,
    tax_profile_status: profile.tax_profile_status as string,
    payment_setup_status: profile.payment_setup_status as string | null,
  });

  if (gate !== "eligible") {
    return { ok: true, skipped: true, reason: `Payout gate: ${gate}` };
  }

  const connectAccountId = (
    profile.stripe_connect_account_id as string | null
  )?.trim();
  if (!connectAccountId) {
    return { ok: false, error: "No Stripe Connect account linked." };
  }

  const { data: inFlight } = await supabase
    .from("partner_payouts")
    .select("id")
    .eq("partner_profile_id", partnerProfileId)
    .eq("status", "scheduled")
    .limit(1)
    .maybeSingle();

  if (inFlight?.id) {
    return {
      ok: true,
      skipped: true,
      reason: "A payout is already in progress for this partner.",
    };
  }

  const { data: payableRows, error: payableError } = await supabase
    .from("partner_earnings")
    .select("id, amount")
    .eq("partner_profile_id", partnerProfileId)
    .eq("status", "payable");

  if (payableError) {
    return { ok: false, error: payableError.message };
  }

  if (!payableRows?.length) {
    return { ok: true, skipped: true, reason: "No payable earnings." };
  }

  const payableIds = payableRows.map((row) => row.id as string);
  const payableAdjustments = await loadAdjustmentsForEarnings(
    supabase,
    payableIds,
  );
  const effectiveById = effectiveAmountsForEarnings(
    payableRows.map((row) => ({
      id: row.id as string,
      amount: row.amount as number | string,
      status: "payable",
    })),
    payableAdjustments,
  );

  const lockIds = payableIds.filter((id) => (effectiveById.get(id) ?? 0) > 0);
  if (lockIds.length === 0) {
    return { ok: true, skipped: true, reason: "No payable earnings with positive balance." };
  }

  const { data: locked, error: lockError } = await supabase
    .from("partner_earnings")
    .update({ status: PAYOUT_LOCK_STATUS, updated_at: new Date().toISOString() })
    .eq("partner_profile_id", partnerProfileId)
    .eq("status", "payable")
    .in("id", lockIds)
    .select("id, amount");

  if (lockError) {
    return { ok: false, error: lockError.message };
  }

  if (!locked?.length) {
    return { ok: true, skipped: true, reason: "No payable earnings." };
  }

  const earningIds = locked.map((row) => row.id as string);
  const grossDollars = earningIds.reduce(
    (sum, id) => sum + (effectiveById.get(id) ?? 0),
    0,
  );

  const { adjustments: clawbacks, totalDollars: clawbackDollars } =
    await loadPendingClawbacksForPartner(supabase, partnerProfileId);

  const totalDollars = Math.round((grossDollars - clawbackDollars) * 100) / 100;
  const totalCents = dollarsToCents(totalDollars);

  if (totalCents <= 0) {
    await releasePayoutLockedEarnings(supabase, earningIds);
    return { ok: true, skipped: true, reason: "Payable total is zero." };
  }

  const minPayout = await loadMinPayoutThreshold(
    supabase,
    partnerProfileId,
    earningIds,
  );
  if (minPayout > 0 && totalDollars < minPayout) {
    await releasePayoutLockedEarnings(supabase, earningIds);
    return {
      ok: true,
      skipped: true,
      reason: `Below minimum payout threshold ($${minPayout.toFixed(2)}).`,
    };
  }

  const { data: payout, error: payoutError } = await supabase
    .from("partner_payouts")
    .insert({
      partner_profile_id: partnerProfileId,
      amount: totalDollars,
      method: "stripe_connect",
      status: "scheduled",
      reference: null,
      paid_at: null,
    })
    .select("id")
    .single();

  if (payoutError || !payout?.id) {
    await releasePayoutLockedEarnings(supabase, earningIds);
    return {
      ok: false,
      error: payoutError?.message ?? "Could not record payout.",
    };
  }

  const payoutId = payout.id as string;
  let transferId: string;
  try {
    const transfer = await getStripe().transfers.create(
      {
        amount: totalCents,
        currency: "usd",
        destination: connectAccountId,
        metadata: {
          partner_profile_id: partnerProfileId,
          partner_payout_id: payoutId,
          earning_ids: earningIds.join(","),
        },
      },
      { idempotencyKey: payoutIdempotencyKey(partnerProfileId, earningIds, connectAccountId, totalCents) },
    );
    transferId = transfer.id;
  } catch (caught) {
    await supabase
      .from("partner_payouts")
      .update({ status: "failed", reference: null })
      .eq("id", payoutId);
    await releasePayoutLockedEarnings(supabase, earningIds);
    return {
      ok: false,
      error: stripeErrorMessage(caught, "Stripe transfer failed."),
      payoutId,
    };
  }

  const paidAt = new Date().toISOString();
  const paidDate = paidAt.slice(0, 10);

  const { error: payoutUpdateError } = await supabase
    .from("partner_payouts")
    .update({
      status: "paid",
      reference: transferId,
      paid_at: paidAt,
    })
    .eq("id", payoutId);

  if (payoutUpdateError) {
    return {
      ok: false,
      error: payoutUpdateError.message,
      transferId,
      payoutId,
    };
  }

  const { error: updateError } = await supabase
    .from("partner_earnings")
    .update({
      status: "paid",
      paid_date: paidDate,
      updated_at: paidAt,
    })
    .in("id", earningIds)
    .eq("status", PAYOUT_LOCK_STATUS);

  if (updateError) {
    return {
      ok: false,
      error: updateError.message,
      transferId,
      payoutId,
    };
  }

  if (clawbacks.length > 0) {
    await markClawbacksApplied(
      supabase,
      clawbacks.map((row) => row.id),
      paidAt,
    );
  }

  const { notifyPartnerPayoutPaid } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  void notifyPartnerPayoutPaid({
    admin: supabase,
    partnerProfileId,
    payoutId,
    amountLabel: `$${totalDollars.toFixed(2)}`,
  }).catch((error: unknown) => {
    console.error(
      "[runStripeConnectTransfer] partner notification failed",
      payoutId,
      error,
    );
  });

  return {
    ok: true,
    payoutId,
    transferId,
    amount: totalDollars,
    earningIds,
  };
}

export async function handleTransferReversed(
  supabase: SupabaseClient,
  transfer: { id: string; metadata?: Record<string, string> | null },
): Promise<void> {
  const transferId = transfer.id;
  const earningIds =
    transfer.metadata?.earning_ids?.split(",").filter(Boolean) ?? [];

  await supabase
    .from("partner_payouts")
    .update({ status: "failed" })
    .eq("reference", transferId);

  if (earningIds.length === 0) return;

  // Re-queue for payout — never reuse §17.1.12 `held`.
  await supabase
    .from("partner_earnings")
    .update({
      status: "payable",
      paid_date: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", earningIds)
    .eq("status", "paid");
}
