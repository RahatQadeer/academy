import type { SupabaseClient } from "@supabase/supabase-js";
import { createEarningFromEvent } from "@/partner-center/lib/attribution/create-earning";
import {
  ENTERPRISE_PAYMENT_QUALIFYING_ACTION,
  validateOpportunityPaymentEligibility,
} from "@/partner-center/lib/attribution/opportunity-payment-eligibility";
import { promoteEarningsToPayable } from "@/partner-center/lib/attribution/promote-payable";
import {
  findEarningForEvent,
  findExistingAttributionEvent,
  findAttributionEventByPaymentId,
} from "@/partner-center/lib/attribution/resolve-referral";
import { isPartnerProgramActive } from "@/partner-center/lib/enable-programs";
import { createPartnerAdminNotification } from "@/super-admin/partner-center/lib/notifications/create-notification";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export type RecordOpportunityPaymentInput = {
  opportunityId: string;
  externalPaymentId: string;
  amountCollectedCents: number;
  eventSource: "stripe" | "quickbooks";
  eventTimestamp?: string;
};

export type RecordOpportunityPaymentResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  eventId?: string;
  earningId?: string;
  programInactive?: boolean;
};

async function notifyProgramInactiveEarning(input: {
  partnerProfileId: string;
  opportunityId: string;
  externalPaymentId: string;
  eventSource: string;
  amountCollectedCents: number;
  eventId?: string;
  error: string;
}): Promise<void> {
  const amount = (input.amountCollectedCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  await createPartnerAdminNotification({
    kind: "payment_unmatched",
    title: "Enterprise payment — program not enabled",
    body: `${amount} ${input.eventSource} payment ${input.externalPaymentId} matched opportunity ${input.opportunityId}, but Enterprise is not enabled for partner ${input.partnerProfileId}. Earning was not created.`,
    href: PC_ADMIN.partner(input.partnerProfileId),
    entityType: "partner_profile",
    entityId: input.partnerProfileId,
  });
  console.error("[partner-attribution] earning blocked — program inactive", {
    ...input,
  });
}

async function createEarningAndPromote(
  supabase: SupabaseClient,
  input: {
    eventId: string;
    partnerProfileId: string;
    opportunityId: string;
    externalPaymentId: string;
    eventSource: string;
    amountCollectedCents: number;
    retryReason?: string;
  },
): Promise<RecordOpportunityPaymentResult> {
  const earningResult = await createEarningFromEvent(supabase, input.eventId, {
    amountCollectedCents: input.amountCollectedCents,
    program: "enterprise",
  });

  if (!earningResult.ok) {
    if (earningResult.programInactive) {
      await notifyProgramInactiveEarning({
        partnerProfileId: input.partnerProfileId,
        opportunityId: input.opportunityId,
        externalPaymentId: input.externalPaymentId,
        eventSource: input.eventSource,
        amountCollectedCents: input.amountCollectedCents,
        eventId: input.eventId,
        error: earningResult.error ?? "Program not enabled.",
      });
    }
    return {
      ok: false,
      error: earningResult.error ?? "Could not create earning.",
      eventId: input.eventId,
      programInactive: earningResult.programInactive,
    };
  }

  try {
    await promoteEarningsToPayable(supabase, input.partnerProfileId);
  } catch (error) {
    console.error(
      "[recordOpportunityPayment] promote after record failed",
      input.partnerProfileId,
      error,
    );
  }

  return {
    ok: true,
    eventId: input.eventId,
    earningId: earningResult.earningId,
    reason: input.retryReason,
  };
}

/**
 * If an attribution event already exists for this payment: skip when an earning
 * exists; otherwise retry earning create (§17.7.11).
 */
async function resolveExistingPaymentEvent(
  supabase: SupabaseClient,
  input: {
    eventId: string;
    eventPartnerProfileId: string;
    opportunityId: string;
    partnerProfileId: string;
    externalPaymentId: string;
    eventSource: string;
    amountCollectedCents: number;
  },
): Promise<RecordOpportunityPaymentResult> {
  if (input.eventPartnerProfileId !== input.partnerProfileId) {
    return {
      ok: true,
      skipped: true,
      reason: "Payment already attributed to another partner.",
      eventId: input.eventId,
    };
  }

  const existingEarningId = await findEarningForEvent(supabase, input.eventId);
  if (existingEarningId) {
    return {
      ok: true,
      skipped: true,
      reason: "Payment already attributed.",
      eventId: input.eventId,
      earningId: existingEarningId,
    };
  }

  return createEarningAndPromote(supabase, {
    eventId: input.eventId,
    partnerProfileId: input.partnerProfileId,
    opportunityId: input.opportunityId,
    externalPaymentId: input.externalPaymentId,
    eventSource: input.eventSource,
    amountCollectedCents: input.amountCollectedCents,
    retryReason: "Retried earning for existing attribution event.",
  });
}

export async function recordOpportunityPayment(
  supabase: SupabaseClient,
  input: RecordOpportunityPaymentInput,
): Promise<RecordOpportunityPaymentResult> {
  const externalPaymentId = input.externalPaymentId.trim();
  if (!externalPaymentId) {
    return { ok: false, error: "Payment identifier is required." };
  }

  if (
    !Number.isFinite(input.amountCollectedCents) ||
    input.amountCollectedCents <= 0
  ) {
    return { ok: false, error: "Collected amount must be greater than zero." };
  }

  const eventTime = input.eventTimestamp
    ? new Date(input.eventTimestamp)
    : new Date();
  if (Number.isNaN(eventTime.getTime())) {
    return { ok: false, error: "Invalid payment timestamp." };
  }

  const { data: opportunity, error: oppError } = await supabase
    .from("partner_opportunities")
    .select("id, partner_profile_id, status, protected_until")
    .eq("id", input.opportunityId)
    .maybeSingle();

  if (oppError || !opportunity?.id) {
    return { ok: false, error: "Opportunity not found." };
  }

  const eligibility = validateOpportunityPaymentEligibility({
    status: opportunity.status as string,
    protectedUntil: (opportunity.protected_until as string | null) ?? null,
    eventTime,
  });
  if (!eligibility.ok) {
    return { ok: false, error: eligibility.error };
  }

  const partnerProfileId = opportunity.partner_profile_id as string;

  const enterpriseActive = await isPartnerProgramActive(
    supabase,
    partnerProfileId,
    "enterprise",
  );
  if (!enterpriseActive) {
    await notifyProgramInactiveEarning({
      partnerProfileId,
      opportunityId: opportunity.id as string,
      externalPaymentId,
      eventSource: input.eventSource,
      amountCollectedCents: input.amountCollectedCents,
      error: "Enterprise program is not enabled for this partner.",
    });
    return {
      ok: false,
      error:
        "Enterprise is not enabled for this partner — earning was not created.",
      programInactive: true,
    };
  }

  // Global payment-id check first (§17.7.11), then partner-scoped.
  const globalExisting = await findAttributionEventByPaymentId(
    supabase,
    externalPaymentId,
  );
  if (globalExisting?.id) {
    return resolveExistingPaymentEvent(supabase, {
      eventId: globalExisting.id,
      eventPartnerProfileId: globalExisting.partner_profile_id,
      opportunityId: opportunity.id as string,
      partnerProfileId,
      externalPaymentId,
      eventSource: input.eventSource,
      amountCollectedCents: input.amountCollectedCents,
    });
  }

  const existing = await findExistingAttributionEvent(
    supabase,
    partnerProfileId,
    externalPaymentId,
  );
  if (existing?.id) {
    return resolveExistingPaymentEvent(supabase, {
      eventId: existing.id,
      eventPartnerProfileId: partnerProfileId,
      opportunityId: opportunity.id as string,
      partnerProfileId,
      externalPaymentId,
      eventSource: input.eventSource,
      amountCollectedCents: input.amountCollectedCents,
    });
  }

  const { data: event, error: eventError } = await supabase
    .from("partner_attribution_events")
    .insert({
      partner_profile_id: partnerProfileId,
      opportunity_id: opportunity.id,
      referred_user_id: null,
      product: "enterprise",
      qualifying_action: ENTERPRISE_PAYMENT_QUALIFYING_ACTION,
      event_source: input.eventSource,
      external_payment_id: externalPaymentId,
      amount_collected_cents: input.amountCollectedCents,
      event_timestamp: eventTime.toISOString(),
    })
    .select("id")
    .single();

  if (eventError || !event?.id) {
    if (eventError?.code === "23505") {
      const raced =
        (await findAttributionEventByPaymentId(supabase, externalPaymentId)) ??
        (await findExistingAttributionEvent(
          supabase,
          partnerProfileId,
          externalPaymentId,
        ));
      if (raced?.id) {
        return resolveExistingPaymentEvent(supabase, {
          eventId: raced.id,
          eventPartnerProfileId: raced.partner_profile_id,
          opportunityId: opportunity.id as string,
          partnerProfileId,
          externalPaymentId,
          eventSource: input.eventSource,
          amountCollectedCents: input.amountCollectedCents,
        });
      }
      return {
        ok: true,
        skipped: true,
        reason: "Payment already attributed.",
      };
    }
    return {
      ok: false,
      error: eventError?.message ?? "Could not record attribution event.",
    };
  }

  return createEarningAndPromote(supabase, {
    eventId: event.id as string,
    partnerProfileId,
    opportunityId: opportunity.id as string,
    externalPaymentId,
    eventSource: input.eventSource,
    amountCollectedCents: input.amountCollectedCents,
  });
}
