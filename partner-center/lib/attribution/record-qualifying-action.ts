import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createEarningFromEvent,
  type CreateEarningResult,
} from "@/partner-center/lib/attribution/create-earning";
import {
  buildConvertedReferralUpdate,
  outcomeAfterConvertThenEarn,
  shouldHealConvertedStatus,
} from "@/partner-center/lib/attribution/referral-conversion-flow";
import {
  findAttributionEventByPaymentId,
  findEarningForEvent,
  findExistingAttributionEvent,
  resolveOpenReferral,
} from "@/partner-center/lib/attribution/resolve-referral";
import type {
  OpenReferralRow,
  QualifyingActionInput,
  QualifyingActionResult,
} from "@/partner-center/lib/attribution/types";
import { ensureProgramReferralForUser } from "@/partner-center/lib/referral-capture/ensure-program-referral";
import { commissionProgramForReferral } from "@/partner-center/lib/referral-capture/infer-program";
import { trackFirstPromoterSale } from "@/partner-center/lib/firstpromoter/track";
import {
  isActionCommissionable,
  loadPlatformAttributionConfig,
} from "@/super-admin/partner-center/services/platform-attribution-config";

function eventTimestamp(input: QualifyingActionInput): Date {
  if (input.eventTimestamp) {
    const parsed = Date.parse(input.eventTimestamp);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return new Date();
}

async function resolveCommissionable(
  supabase: SupabaseClient,
  input: QualifyingActionInput,
): Promise<boolean> {
  try {
    const config = await loadPlatformAttributionConfig(supabase);
    const configured = isActionCommissionable(
      config.conversionEligibility,
      input.product === "academy" ? "academy" : "whitbyos",
      input.qualifyingAction,
    );
    if (configured != null) return configured;
  } catch {
    // fall through to caller flag
  }
  return input.commissionable;
}

async function markReferralConverted(
  supabase: SupabaseClient,
  referralId: string,
  eventTime: Date,
  productId?: string,
): Promise<{ error?: string; changed: boolean; partnerProfileId?: string }> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .update(buildConvertedReferralUpdate(eventTime, productId))
    .eq("id", referralId)
    .in("status", ["referred", "in_progress"])
    .select("id, partner_profile_id")
    .maybeSingle();
  if (error) return { error: error.message, changed: false };
  if (!data?.id) return { changed: false };
  return {
    changed: true,
    partnerProfileId: data.partner_profile_id as string,
  };
}

async function notifyReferralStatusChange(
  supabase: SupabaseClient,
  partnerProfileId: string,
  referralId: string,
  status: string,
): Promise<void> {
  const { notifyPartnerReferralStatus } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  const result = await notifyPartnerReferralStatus({
    admin: supabase,
    partnerProfileId,
    referralId,
    status,
  });
  if (!result.ok) {
    console.error(
      "[recordQualifyingAction] partner notification failed",
      referralId,
      status,
      result.error,
    );
  }
}

type CreateEarningFn = (
  supabase: SupabaseClient,
  eventId: string,
  options?: {
    amountCollectedCents?: number;
    program?: "academy" | "platform" | "enterprise";
  },
) => Promise<CreateEarningResult>;

/** Optional deps for unit tests — production callers omit this. */
export type RecordQualifyingActionDeps = {
  createEarning?: CreateEarningFn;
  resolveCommissionableOverride?: (
    supabase: SupabaseClient,
    input: QualifyingActionInput,
  ) => Promise<boolean>;
  resolveOpenReferral?: typeof resolveOpenReferral;
  findExistingAttributionEvent?: typeof findExistingAttributionEvent;
  findAttributionEventByPaymentId?: typeof findAttributionEventByPaymentId;
  findEarningForEvent?: typeof findEarningForEvent;
  ensureProgramReferralForUser?: typeof ensureProgramReferralForUser;
  trackFirstPromoterSale?: typeof trackFirstPromoterSale;
};

async function applyCommissionableConversion(
  supabase: SupabaseClient,
  input: QualifyingActionInput,
  referral: OpenReferralRow,
  eventId: string,
  eventTime: Date,
  createEarning: CreateEarningFn,
  trackSale: typeof trackFirstPromoterSale,
  reason?: string,
): Promise<QualifyingActionResult> {
  const referralId = referral.id;

  const converted = await markReferralConverted(
    supabase,
    referralId,
    eventTime,
    input.productId,
  );
  if (converted.error) {
    return {
      ok: false,
      error: converted.error,
      eventId,
      referralId,
    };
  }

  if (converted.changed) {
    void notifyReferralStatusChange(
      supabase,
      converted.partnerProfileId ?? referral.partner_profile_id,
      referralId,
      "converted",
    );
  }

  let earning: CreateEarningResult;
  try {
    earning = await createEarning(supabase, eventId, {
      amountCollectedCents: input.amountCollectedCents,
      program: commissionProgramForReferral(referral.program) ?? "platform",
    });
  } catch (error) {
    earning = {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not create earning.",
    };
  }

  const outcome = outcomeAfterConvertThenEarn(earning);
  if (outcome.earningError) {
    console.error(
      "[partner attribution] earning failed after conversion",
      outcome.earningError,
      eventId,
    );
  }

  void trackSale(supabase, {
    partnerProfileId: referral.partner_profile_id,
    referredUserId: input.referredUserId,
    eventId,
    amountCollectedCents: input.amountCollectedCents,
    externalPaymentId: input.externalPaymentId,
  });

  return {
    ok: true,
    eventId,
    referralId,
    earningId: outcome.earningId,
    referralStatus: outcome.referralStatus,
    earningError: outcome.earningError,
    ...(reason ? { reason } : {}),
  };
}

export async function recordQualifyingAction(
  supabase: SupabaseClient,
  input: QualifyingActionInput,
  deps?: RecordQualifyingActionDeps,
): Promise<QualifyingActionResult> {
  const eventTime = eventTimestamp(input);
  const createEarning = deps?.createEarning ?? createEarningFromEvent;
  const resolveOpen = deps?.resolveOpenReferral ?? resolveOpenReferral;
  const findExisting =
    deps?.findExistingAttributionEvent ?? findExistingAttributionEvent;
  const findByPaymentId =
    deps?.findAttributionEventByPaymentId ?? findAttributionEventByPaymentId;
  const findEarning = deps?.findEarningForEvent ?? findEarningForEvent;
  const ensureReferral =
    deps?.ensureProgramReferralForUser ?? ensureProgramReferralForUser;
  const trackSale = deps?.trackFirstPromoterSale ?? trackFirstPromoterSale;
  const commissionable = deps?.resolveCommissionableOverride
    ? await deps.resolveCommissionableOverride(supabase, input)
    : await resolveCommissionable(supabase, input);

  let referral = await resolveOpen(
    supabase,
    input.referredUserId,
    input.product,
    eventTime,
  );

  if (!referral) {
    try {
      await ensureReferral(supabase, {
        userId: input.referredUserId,
        program: input.product,
      });
    } catch {
      // Fall through to skip if ensure fails.
    }
    referral = await resolveOpen(
      supabase,
      input.referredUserId,
      input.product,
      eventTime,
    );
  }

  if (!referral) {
    return {
      ok: true,
      skipped: true,
      reason: "No open referral within attribution window.",
    };
  }

  if (input.externalPaymentId) {
    const globalExisting = await findByPaymentId(
      supabase,
      input.externalPaymentId,
    );
    if (
      globalExisting?.id &&
      globalExisting.partner_profile_id !== referral.partner_profile_id
    ) {
      return {
        ok: true,
        skipped: true,
        reason: "Payment already attributed to another partner.",
        eventId: globalExisting.id,
      };
    }

    const existing =
      globalExisting?.partner_profile_id === referral.partner_profile_id
        ? globalExisting
        : await findExisting(
            supabase,
            referral.partner_profile_id,
            input.externalPaymentId,
          );
    if (existing?.id) {
      const existingEarningId = await findEarning(supabase, existing.id);
      const referralId = existing.referral_id ?? referral.id;

      if (existingEarningId) {
        // Heal stuck referrals: earning exists but status never flipped.
        if (shouldHealConvertedStatus(referral.status)) {
          const healed = await markReferralConverted(
            supabase,
            referral.id,
            eventTime,
            input.productId,
          );
          if (healed.error) {
            return {
              ok: false,
              error: healed.error,
              eventId: existing.id,
              referralId,
              earningId: existingEarningId,
            };
          }
          if (healed.changed) {
            void notifyReferralStatusChange(
              supabase,
              healed.partnerProfileId ?? referral.partner_profile_id,
              referral.id,
              "converted",
            );
          }
          return {
            ok: true,
            eventId: existing.id,
            referralId,
            earningId: existingEarningId,
            referralStatus: "converted",
            reason: "Healed converted status for existing earning.",
          };
        }

        return {
          ok: true,
          skipped: true,
          reason: "Duplicate external payment id.",
          eventId: existing.id,
          referralId,
          earningId: existingEarningId,
        };
      }

      if (commissionable) {
        return applyCommissionableConversion(
          supabase,
          input,
          referral,
          existing.id,
          eventTime,
          createEarning,
          trackSale,
          "Retried earning for existing attribution event.",
        );
      }

      return {
        ok: true,
        skipped: true,
        reason: "Duplicate external payment id.",
        eventId: existing.id,
        referralId,
      };
    }
  }

  const { data: event, error: eventError } = await supabase
    .from("partner_attribution_events")
    .insert({
      partner_profile_id: referral.partner_profile_id,
      referral_id: referral.id,
      referred_user_id: input.referredUserId,
      product: input.product,
      qualifying_action: input.qualifyingAction,
      event_source: input.eventSource,
      external_payment_id: input.externalPaymentId ?? null,
      amount_collected_cents: input.amountCollectedCents ?? null,
      event_timestamp: eventTime.toISOString(),
    })
    .select("id")
    .single();

  if (eventError || !event?.id) {
    return {
      ok: false,
      error: eventError?.message ?? "Could not record attribution event.",
    };
  }

  const eventId = event.id as string;

  if (commissionable) {
    return applyCommissionableConversion(
      supabase,
      input,
      referral,
      eventId,
      eventTime,
      createEarning,
      trackSale,
    );
  }

  if (referral.status === "referred") {
    const { data: progressed, error: statusError } = await supabase
      .from("partner_referrals")
      .update({ status: "in_progress" })
      .eq("id", referral.id)
      .eq("status", "referred")
      .select("id")
      .maybeSingle();
    if (statusError) {
      return {
        ok: false,
        error: statusError.message,
        eventId,
        referralId: referral.id,
      };
    }
    if (progressed?.id) {
      void notifyReferralStatusChange(
        supabase,
        referral.partner_profile_id,
        referral.id,
        "in_progress",
      );
    }
    return {
      ok: true,
      eventId,
      referralId: referral.id,
      referralStatus: "in_progress",
    };
  }

  return {
    ok: true,
    eventId,
    referralId: referral.id,
    referralStatus: referral.status,
  };
}
