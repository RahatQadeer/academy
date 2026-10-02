import { cookies } from "next/headers";
import { getSessionProfile } from "@/base/identity/session";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { ensureProgramReferralForUser } from "@/partner-center/lib/referral-capture/ensure-program-referral";
import { resolveReferralAttributionFromCookie } from "@/partner-center/lib/referral-capture/parse-referral-cookie";

export type EnsurePlatformReferralOptions = {
  /** Workspace that just entered / is on Whitby product trial. */
  workspaceId?: string;
};

/**
 * Open Whitby (whitbyos) referral when a referred user enters Whitby.
 * Product trial (onboarding / entitlement) advances Referred → In Progress
 * (SRS §17.5.14 — tracked, not commissionable). Stripe subscription
 * `trialing` remains a second idempotent path via notifyPartnerPlatformTrialStarted.
 * Converted is first paid invoice. Never throws.
 */
export async function ensurePlatformReferralOnEntry(
  options?: EnsurePlatformReferralOptions,
): Promise<void> {
  try {
    const profile = await getSessionProfile();
    const user = profile?.user;
    if (!user?.id || !user.email) return;

    const supabase = createAdminClient();
    if (!supabase) {
      console.warn(
        "[whitby referral] admin client unavailable; skipping ensure.",
      );
      return;
    }

    const attribution = resolveReferralAttributionFromCookie(await cookies());

    const ensured = await ensureProgramReferralForUser(supabase, {
      userId: user.id,
      email: user.email,
      fullName: user.full_name || user.preferred_name || undefined,
      program: "whitbyos",
      referralCode: attribution?.code,
      capturedAt: attribution?.capturedAt,
    });

    if (!ensured.referralId) {
      console.info(
        "[whitby referral] no whitbyos referral opened (no code/sibling)",
        user.id,
      );
      return;
    }

    // Product trial begins at Whitby entry / onboarding — not only Stripe.
    const { recordQualifyingAction } = await import(
      "@/partner-center/lib/attribution"
    );
    const trialRef = options?.workspaceId
      ? `product_trial:workspace:${options.workspaceId}`
      : `product_trial:user:${user.id}`;

    const progressed = await recordQualifyingAction(supabase, {
      referredUserId: user.id,
      product: "whitbyos",
      qualifyingAction: "whitby_product_trial_started",
      commissionable: false,
      eventSource: "manual",
      externalPaymentId: trialRef,
    });

    if (!progressed.ok) {
      console.error("[whitby referral] trial → in_progress failed", progressed);
      return;
    }

    console.info(
      "[whitby referral] whitbyos referral ready",
      ensured.referralId,
      progressed.referralStatus ?? "ok",
      user.id,
    );
  } catch (error) {
    console.error("[whitby referral] ensure on entry error", error);
  }
}
