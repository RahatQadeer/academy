import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import type {
  AcademyEnrollment,
  AcademyEntitlementSource,
  AcademyEnrollmentStatus,
} from "@/academy/lib/domain";
import type { CheckoutUnavailableReason } from "../types";

const CHECKOUT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EnrollmentRow = {
  id: string;
  user_id: string;
  program_id: string;
  status: AcademyEnrollmentStatus;
  progress_percent: number;
  entitlement_source: AcademyEntitlementSource | null;
  enrolled_at: string;
  completed_at: string | null;
};

const ENROLLMENT_COLUMNS =
  "id, user_id, program_id, status, progress_percent, entitlement_source, enrolled_at, completed_at";

function asEnrollment(row: EnrollmentRow): AcademyEnrollment {
  return {
    id: row.id,
    user_id: row.user_id,
    program_id: row.program_id,
    status: row.status,
    progress_percent: row.progress_percent,
    entitlement_source: row.entitlement_source,
    enrolled_at: row.enrolled_at,
    completed_at: row.completed_at,
  };
}

export function mapCheckoutRpcError(message: string): CheckoutUnavailableReason | null {
  if (message.includes("checkout_not_found")) return "not_found";
  if (message.includes("checkout_expired")) return "checkout_expired";
  if (message.includes("checkout_not_pending")) return "checkout_not_pending";
  if (message.includes("program_unavailable")) return "unpublished";
  if (message.includes("amount_mismatch")) return "amount_mismatch";
  return null;
}

export async function loadEnrollmentById(enrollmentId: string): Promise<AcademyEnrollment | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("academy_enrollments")
    .select(ENROLLMENT_COLUMNS)
    .eq("id", enrollmentId)
    .maybeSingle();
  return data ? asEnrollment(data as EnrollmentRow) : null;
}

async function notifyPaidEnrollmentAttribution(
  checkoutId: string,
  enrollment: AcademyEnrollment,
) {
  const admin = createAdminClient();
  const { data: checkoutRow } = await admin
    .from("academy_checkout_sessions")
    .select("amount, stripe_payment_intent_id, user_id, program_id")
    .eq("id", checkoutId)
    .maybeSingle();
  const amountDollars = Number(
    (checkoutRow as { amount?: number | string } | null)?.amount ?? 0,
  );
  const amountCollectedCents = Number.isFinite(amountDollars)
    ? Math.round(amountDollars * 100)
    : undefined;
  const paymentIntent =
    (checkoutRow as { stripe_payment_intent_id?: string | null } | null)
      ?.stripe_payment_intent_id ?? undefined;

  const payload = {
    referredUserId: enrollment.user_id,
    product: "academy" as const,
    qualifyingAction: "paid_enrollment",
    commissionable: true,
    eventSource: "stripe" as const,
    externalPaymentId: paymentIntent ?? `academy_checkout_${checkoutId}`,
    productId: enrollment.program_id,
    amountCollectedCents,
  };

  // In-process first — HTTP self-fetch to SITE_URL is flaky on Vercel
  // (wrong host / same-isolate freeze). Academy still has HTTP helper for
  // external callers; checkout fulfill should not depend on it.
  try {
    const { createAdminClient: createPartnerAdmin } = await import(
      "@/partner-center/lib/supabase-admin"
    );
    const {
      recordQualifyingAction,
      promoteEarningsToPayable,
    } = await import("@/partner-center/lib/attribution");
    const partnerDb = createPartnerAdmin();
    if (partnerDb) {
      const result = await recordQualifyingAction(partnerDb, payload);
      if (!result.ok) {
        console.error("[academy attribution] in-process failed", result);
      } else if (result.referralId) {
        const { data: profile } = await partnerDb
          .from("partner_referrals")
          .select("partner_profile_id")
          .eq("id", result.referralId)
          .maybeSingle();
        if (profile?.partner_profile_id) {
          await promoteEarningsToPayable(
            partnerDb,
            profile.partner_profile_id as string,
          );
        }
      }
      return;
    }
  } catch (error) {
    console.error("[academy attribution] in-process error", error);
  }

  const { notifyPartnerAcademyAttribution } = await import(
    "@/academy/lib/notifyPartnerAttribution"
  );
  await notifyPartnerAcademyAttribution({
    referredUserId: payload.referredUserId,
    qualifyingAction: "paid_enrollment",
    commissionable: true,
    eventSource: "stripe",
    externalPaymentId: payload.externalPaymentId,
    productId: payload.productId,
    amountCollectedCents: payload.amountCollectedCents,
  });
}

export async function fulfillCheckoutById(checkoutId: string): Promise<
  | { ok: true; enrollment: AcademyEnrollment; alreadyPaid: boolean }
  | { ok: false; reason: CheckoutUnavailableReason }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "failed" };
  }
  if (!CHECKOUT_ID.test(checkoutId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminClient();

  const { data: checkout } = await admin
    .from("academy_checkout_sessions")
    .select("id, status, enrollment_id")
    .eq("id", checkoutId)
    .maybeSingle();

  if (!checkout) {
    return { ok: false, reason: "not_found" };
  }

  const row = checkout as { id: string; status: string; enrollment_id: string | null };
  if (row.status === "paid" && row.enrollment_id) {
    const enrollment = await loadEnrollmentById(row.enrollment_id);
    if (enrollment) {
      // Retry attribution if the first fulfill's background call was dropped.
      try {
        await notifyPaidEnrollmentAttribution(checkoutId, enrollment);
      } catch {
        // Enrollment already paid — attribution must not fail the client.
      }
      return { ok: true, enrollment, alreadyPaid: true };
    }
  }

  const { data: enrollmentId, error } = await admin.rpc("academy_fulfill_checkout", {
    p_checkout_id: checkoutId,
  });

  if (error) {
    return { ok: false, reason: mapCheckoutRpcError(error.message) ?? "failed" };
  }

  const enrollment = await loadEnrollmentById(enrollmentId as string);
  if (!enrollment) {
    return { ok: false, reason: "failed" };
  }

  try {
    await notifyPaidEnrollmentAttribution(checkoutId, enrollment);
  } catch {
    // Attribution must never block enrollment / checkout.
  }

  return { ok: true, enrollment, alreadyPaid: false };
}

export async function fulfillCheckoutByStripeSessionId(stripeSessionId: string): Promise<
  | { ok: true; enrollment: AcademyEnrollment; alreadyPaid: boolean; checkoutId: string }
  | { ok: false; reason: CheckoutUnavailableReason }
> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, reason: "failed" };
  }

  const admin = createAdminClient();
  const { data: checkout } = await admin
    .from("academy_checkout_sessions")
    .select("id")
    .eq("stripe_checkout_session_id", stripeSessionId)
    .maybeSingle();

  if (!checkout) {
    return { ok: false, reason: "not_found" };
  }

  const result = await fulfillCheckoutById((checkout as { id: string }).id);
  if (!result.ok) return result;

  return { ...result, checkoutId: (checkout as { id: string }).id };
}

export async function attachStripePaymentIntent(
  checkoutId: string,
  paymentIntentId: string | null,
) {
  if (!paymentIntentId || !isSupabaseAdminConfigured()) return;

  const admin = createAdminClient();
  await admin
    .from("academy_checkout_sessions")
    .update({
      stripe_payment_intent_id: paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", checkoutId);
}
