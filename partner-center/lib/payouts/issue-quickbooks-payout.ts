import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePayoutGate } from "@/partner-center/lib/payout-gate";
import {
  effectiveAmountsForEarnings,
  loadAdjustmentsForEarnings,
  loadPendingClawbacksForPartner,
  markClawbacksApplied,
} from "@/partner-center/lib/attribution/payout-amounts";
import {
  PAYOUT_LOCK_STATUS,
  releasePayoutLockedEarnings,
} from "@/partner-center/lib/payouts/payout-lock";
import { writePayoutMethodAudit } from "@/partner-center/settings/lib/tax-audit";
import type { RunStripePayoutResult } from "@/partner-center/lib/payouts/types";
import { loadPlatformTaxConfig } from "@/super-admin/partner-center/services/platform-tax-config";

export type IssueQuickBooksPayoutResult = RunStripePayoutResult;

export async function issueQuickBooksPayout(
  supabase: SupabaseClient,
  input: {
    partnerProfileId: string;
    reference: string;
    actorUserId: string | null;
    /** Admin override when preferred method is not quickbooks. */
    overrideReason?: string | null;
  },
): Promise<IssueQuickBooksPayoutResult> {
  const reference = input.reference.trim();
  if (!reference) {
    return { ok: false, error: "Enter a payout reference." };
  }

  const platform = await loadPlatformTaxConfig(supabase);
  if (!platform.availablePayoutMethods.includes("quickbooks")) {
    return {
      ok: false,
      error:
        "QuickBooks is not an enabled payout method. Enable it in Program config first.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("partner_profiles")
    .select(
      "id, preferred_payout_method, payout_eligibility, tax_profile_status, payment_setup_status",
    )
    .eq("id", input.partnerProfileId)
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

  const preferred = profile.preferred_payout_method as string | null;
  if (preferred !== "quickbooks") {
    const reason = input.overrideReason?.trim();
    if (!reason) {
      return {
        ok: false,
        error:
          "Partner preferred method is not QuickBooks. Provide an override reason to continue.",
      };
    }
  }

  const { data: inFlight } = await supabase
    .from("partner_payouts")
    .select("id")
    .eq("partner_profile_id", input.partnerProfileId)
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
    .eq("partner_profile_id", input.partnerProfileId)
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
    return {
      ok: true,
      skipped: true,
      reason: "No payable earnings with positive balance.",
    };
  }

  const { data: locked, error: lockError } = await supabase
    .from("partner_earnings")
    .update({
      status: PAYOUT_LOCK_STATUS,
      updated_at: new Date().toISOString(),
    })
    .eq("partner_profile_id", input.partnerProfileId)
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
    await loadPendingClawbacksForPartner(supabase, input.partnerProfileId);

  const totalDollars = Math.round((grossDollars - clawbackDollars) * 100) / 100;

  if (totalDollars <= 0) {
    await releasePayoutLockedEarnings(supabase, earningIds);
    return { ok: true, skipped: true, reason: "Payable total is zero." };
  }

  const { loadMinPayoutThreshold } = await import(
    "@/partner-center/lib/attribution/promote-payable"
  );
  const minPayout = await loadMinPayoutThreshold(
    supabase,
    input.partnerProfileId,
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

  const paidAt = new Date().toISOString();
  const paidDate = paidAt.slice(0, 10);

  const { data: payout, error: payoutError } = await supabase
    .from("partner_payouts")
    .insert({
      partner_profile_id: input.partnerProfileId,
      amount: totalDollars,
      method: "quickbooks",
      status: "paid",
      reference,
      paid_at: paidAt,
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
    return { ok: false, error: updateError.message, payoutId };
  }

  if (clawbacks.length > 0) {
    await markClawbacksApplied(
      supabase,
      clawbacks.map((row) => row.id),
      paidAt,
    );
  }

  if (input.actorUserId) {
    const audit = await writePayoutMethodAudit(supabase, {
      actorUserId: input.actorUserId,
      entityId: payoutId,
      previousMethod: preferred,
      newMethod: "quickbooks",
      reason:
        input.overrideReason?.trim() ||
        `Issue QuickBooks payout recorded (${reference})`,
      extra: {
        amount: totalDollars,
        earning_ids: earningIds,
        partner_profile_id: input.partnerProfileId,
        status: "paid",
      },
    });
    if (audit.error) {
      return { ok: false, error: audit.error, payoutId, amount: totalDollars };
    }
  }

  const { notifyPartnerPayoutPaid } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  void notifyPartnerPayoutPaid({
    admin: supabase,
    partnerProfileId: input.partnerProfileId,
    payoutId,
    amountLabel: `$${totalDollars.toFixed(2)}`,
  }).catch((error: unknown) => {
    console.error(
      "[issueQuickbooksPayout] partner notification failed",
      payoutId,
      error,
    );
  });

  return {
    ok: true,
    payoutId,
    amount: totalDollars,
    earningIds,
  };
}
