import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { siteUrl } from "@/base/auth/site";
import { canAccessLearnerArea } from "@/academy/lib/authorization";
import { getStripe, isStripeConfigured, stripeAmountCents } from "@/academy/lib/stripe/server";
import {
  academyStripeCheckoutPresentation,
  academyStripeProductData,
} from "@/academy/lib/stripe/checkoutBranding";
import { applyCredentialRenewalTerm } from "@/academy/lib/credentialRenewal/applyRenewalTerm";
import { writeCredentialReviewLog } from "@/academy/lib/credentialReviewLog";
import { UUID } from "@/academy/admin/types";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";

export type StartRenewalPaymentResult =
  | { ok: true; url: string }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "failed"; message: string };

export async function startRenewalPayment(
  renewalRequestIdRaw: string,
): Promise<StartRenewalPaymentResult> {
  const renewalRequestId = renewalRequestIdRaw.trim().toLowerCase();
  if (!UUID.test(renewalRequestId)) {
    return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
  }
  if (!isSupabaseConfigured() || !isStripeConfigured()) {
    return { ok: false, reason: "failed", message: "Payment is temporarily unavailable." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile || !(await canAccessLearnerArea({ id: profile.user.id }))) {
      return { ok: false, reason: "unauthorized", message: "Sign in to pay for renewal." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credential_renewal_requests")
      .select(
        "id, credential_id, learner_user_id, status, payment_required, payment_amount, payment_currency, payment_status, form_required, form_status, stripe_checkout_session_id, academy_credentials ( academy_programs ( name, description ) )",
      )
      .eq("id", renewalRequestId)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
    }

    const row = data as {
      id: string;
      credential_id: string;
      learner_user_id: string;
      status: string;
      payment_required: boolean;
      payment_amount: number | string | null;
      payment_currency: string;
      payment_status: string;
      form_required: boolean;
      form_status: string;
      stripe_checkout_session_id: string | null;
      academy_credentials:
        | {
            academy_programs:
              | { name: string | null; description: string | null }
              | { name: string | null; description: string | null }[]
              | null;
          }
        | {
            academy_programs:
              | { name: string | null; description: string | null }
              | { name: string | null; description: string | null }[]
              | null;
          }[]
        | null;
    };

    if (row.learner_user_id !== profile.user.id) {
      return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
    }
    if (!row.payment_required || !["awaiting_payment", "awaiting_form_and_payment"].includes(row.status)) {
      return {
        ok: false,
        reason: "invalid",
        message: "This renewal is not waiting for payment.",
      };
    }
    if (row.form_required && row.form_status !== "submitted" && row.status === "awaiting_form_and_payment") {
      // Payment may proceed before the form; both are required before admin review.
    } else if (
      row.form_required &&
      row.form_status !== "submitted" &&
      row.status === "awaiting_payment"
    ) {
      return {
        ok: false,
        reason: "invalid",
        message: "Complete the requested information before paying.",
      };
    }

    const amount = Number(row.payment_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: "invalid", message: "A renewal fee is not configured." };
    }

    const credential = Array.isArray(row.academy_credentials)
      ? row.academy_credentials[0]
      : row.academy_credentials;
    const program = Array.isArray(credential?.academy_programs)
      ? credential?.academy_programs[0]
      : credential?.academy_programs;
    const programName = program?.name?.trim() || "Academy certificate renewal";

    const stripe = getStripe();
    const origin = siteUrl();
    const successUrl = `${origin}/academy/credentials/${row.credential_id}/renew?paid=1`;
    const cancelUrl = `${origin}/academy/credentials/${row.credential_id}/renew?canceled=1`;

    if (row.stripe_checkout_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id);
        if (existing.status === "open" && existing.url) {
          return { ok: true, url: existing.url };
        }
      } catch {
        // create a fresh session
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: renewalRequestId,
      metadata: {
        academy_renewal_request_id: renewalRequestId,
        academy_credential_id: row.credential_id,
        academy_user_id: profile.user.id,
        academy_kind: "credential_renewal",
      },
      ...academyStripeCheckoutPresentation({
        programName: `${programName} — renewal`,
        customerEmail: profile.user.email,
      }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (row.payment_currency || "usd").toLowerCase(),
            unit_amount: stripeAmountCents(amount),
            product_data: academyStripeProductData({
              programName: `${programName} — certificate renewal`,
              programId: row.credential_id,
              programDescription: program?.description,
            }),
          },
        },
      ],
    });

    if (!session.url) {
      return { ok: false, reason: "failed", message: "Checkout could not be started." };
    }

    await supabase
      .from("academy_credential_renewal_requests")
      .update({
        stripe_checkout_session_id: session.id,
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", renewalRequestId);

    return { ok: true, url: session.url };
  } catch {
    return { ok: false, reason: "failed", message: "Checkout could not be started." };
  }
}

/**
 * Mark renewal payment paid. Auto-renews when payment-only; otherwise moves to under_review.
 */
export async function fulfillRenewalPaymentByStripeSessionId(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!sessionId || !isSupabaseAdminConfigured()) {
    return { ok: false, reason: "unavailable" };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "unavailable" };

  const { data, error } = await admin
    .from("academy_credential_renewal_requests")
    .select(
      "id, credential_id, status, payment_required, form_required, form_status, payment_status, academy_credentials ( expires_at, status )",
    )
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (error) return { ok: false, reason: "failed" };
  if (!data) return { ok: false, reason: "not_found" };

  const row = data as {
    id: string;
    credential_id: string;
    status: string;
    payment_required: boolean;
    form_required: boolean;
    form_status: string;
    payment_status: string;
    academy_credentials:
      | { expires_at: string | null; status: string }
      | { expires_at: string | null; status: string }[]
      | null;
  };

  if (row.payment_status === "paid") return { ok: true };

  const now = new Date().toISOString();
  const formDone = !row.form_required || row.form_status === "submitted";
  const paymentOnly = row.payment_required && !row.form_required;

  if (paymentOnly) {
    const credential = Array.isArray(row.academy_credentials)
      ? row.academy_credentials[0]
      : row.academy_credentials;
    if (!credential?.expires_at || credential.status !== "awarded") {
      return { ok: false, reason: "invalid" };
    }

    const applied = await applyCredentialRenewalTerm({
      supabase: admin as never,
      credentialId: row.credential_id,
      currentExpiresAt: credential.expires_at,
    });
    if (!applied.ok) return { ok: false, reason: "failed" };

    await admin
      .from("academy_credential_renewal_requests")
      .update({
        status: "approved",
        payment_status: "paid",
        paid_at: now,
        expires_at_after: applied.expiresAt,
        updated_at: now,
      })
      .eq("id", row.id);

    await writeCredentialReviewLog({
      credentialId: row.credential_id,
      actorUserId: null,
      action: "renew",
      notes: "Auto-renewed after successful renewal payment.",
      previousStatus: "awarded",
      nextStatus: "awarded",
    });

    return { ok: true };
  }

  await admin
    .from("academy_credential_renewal_requests")
    .update({
      status: formDone ? "under_review" : "awaiting_form",
      payment_status: "paid",
      paid_at: now,
      updated_at: now,
    })
    .eq("id", row.id);

  await admin
    .from("academy_credentials")
    .update({ renewal_status: formDone ? "under_review" : "awaiting_learner" })
    .eq("id", row.credential_id);

  return { ok: true };
}
