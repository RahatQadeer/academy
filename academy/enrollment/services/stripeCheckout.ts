import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { getSessionProfile } from "@/base/identity/session";
import { siteUrl } from "@/base/auth/site";
import {
  canAccessAcademy,
  canAccessLearnerArea,
} from "@/academy/lib/authorization";
import { getStripe, isStripeConfigured, stripeAmountCents } from "@/academy/lib/stripe/server";
import {
  academyStripeCheckoutPresentation,
  academyStripeProductData,
} from "@/academy/lib/stripe/checkoutBranding";
import { checkoutSessionHref } from "../utils/checkoutHref";
import type { CheckoutUnavailableReason, StartStripeCheckoutResult } from "../types";
import {
  attachStripePaymentIntent,
  fulfillCheckoutById,
  loadEnrollmentById,
} from "./fulfillCheckoutById";

const CHECKOUT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CheckoutRow = {
  id: string;
  user_id: string;
  program_id: string;
  amount: number | string;
  currency: string;
  status: string;
  stripe_checkout_session_id: string | null;
  enrollment_id: string | null;
  academy_programs:
    | { name: string; status: string; description: string | null }
    | { name: string; status: string; description: string | null }[]
    | null;
};

async function authorizeCheckoutOwner(checkoutId: string) {
  if (!isSupabaseConfigured() || !isStripeConfigured()) {
    return { ok: false as const, reason: "failed" as CheckoutUnavailableReason };
  }
  if (!CHECKOUT_ID.test(checkoutId)) {
    return { ok: false as const, reason: "not_found" as CheckoutUnavailableReason };
  }

  const profile = await getSessionProfile();
  if (!profile) {
    return { ok: false as const, reason: "unauthenticated" as CheckoutUnavailableReason };
  }

  const user = { id: profile.user.id };
  if (!(await canAccessAcademy(user))) {
    return { ok: false as const, reason: "no_academy_access" as CheckoutUnavailableReason };
  }
  if (!(await canAccessLearnerArea(user))) {
    return { ok: false as const, reason: "no_learner_capability" as CheckoutUnavailableReason };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academy_checkout_sessions")
    .select(
      "id, user_id, program_id, amount, currency, status, stripe_checkout_session_id, enrollment_id, academy_programs ( name, status, description )",
    )
    .eq("id", checkoutId)
    .maybeSingle();

  if (error) return { ok: false as const, reason: "failed" as CheckoutUnavailableReason };
  if (!data) return { ok: false as const, reason: "not_found" as CheckoutUnavailableReason };

  const row = data as unknown as CheckoutRow;
  if (row.user_id !== user.id) {
    return { ok: false as const, reason: "not_found" as CheckoutUnavailableReason };
  }

  const program = Array.isArray(row.academy_programs)
    ? row.academy_programs[0]
    : row.academy_programs;
  if (!program || program.status !== "published") {
    return { ok: false as const, reason: "unpublished" as CheckoutUnavailableReason };
  }

  return {
    ok: true as const,
    row,
    programName: program.name,
    programDescription: program.description,
    userId: user.id,
    customerEmail: profile.user.email ?? null,
  };
}

async function createStripeCheckoutSession(input: {
  checkoutId: string;
  programId: string;
  programName: string;
  programDescription?: string | null;
  userId: string;
  customerEmail?: string | null;
  amount: number;
  currency: string;
}) {
  const stripe = getStripe();
  const origin = siteUrl();
  const successUrl = `${origin}${checkoutSessionHref(input.checkoutId)}?success=1`;
  const cancelUrl = `${origin}${checkoutSessionHref(input.checkoutId)}?canceled=1`;

  return stripe.checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: input.checkoutId,
    metadata: {
      academy_checkout_id: input.checkoutId,
      academy_program_id: input.programId,
      academy_user_id: input.userId,
    },
    ...academyStripeCheckoutPresentation({
      programName: input.programName,
      customerEmail: input.customerEmail,
    }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: stripeAmountCents(input.amount),
          product_data: academyStripeProductData({
            programName: input.programName,
            programId: input.programId,
            programDescription: input.programDescription,
          }),
        },
      },
    ],
  });
}

export async function startStripeCheckout(checkoutId: string): Promise<StartStripeCheckoutResult> {
  const auth = await authorizeCheckoutOwner(checkoutId);
  if (!auth.ok) return { status: "unavailable", reason: auth.reason };

  const { row, programName, programDescription, userId, customerEmail } = auth;

  if (row.status === "paid" && row.enrollment_id) {
    const enrollment = await loadEnrollmentById(row.enrollment_id);
    if (enrollment) {
      return { status: "paid", enrollment };
    }
  }

  if (row.status !== "pending") {
    return {
      status: "unavailable",
      reason: row.status === "expired" ? "checkout_expired" : "checkout_not_pending",
    };
  }

  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: "unavailable", reason: "free_program" };
  }

  try {
    const stripe = getStripe();

    if (row.stripe_checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id);
      if (existing.payment_status === "paid") {
        await attachStripePaymentIntent(
          checkoutId,
          typeof existing.payment_intent === "string"
            ? existing.payment_intent
            : existing.payment_intent?.id ?? null,
        );
        const fulfilled = await fulfillCheckoutById(checkoutId);
        if (fulfilled.ok) {
          return { status: "paid", enrollment: fulfilled.enrollment };
        }
        return { status: "unavailable", reason: fulfilled.reason };
      }
      // Expire stale open sessions so new branding / product copy is applied.
      if (existing.status === "open") {
        try {
          await stripe.checkout.sessions.expire(existing.id);
        } catch {
          /* already completed or expired */
        }
      }
    }

    if (!isSupabaseAdminConfigured()) {
      return { status: "unavailable", reason: "failed" };
    }

    const session = await createStripeCheckoutSession({
      checkoutId,
      programId: row.program_id,
      programName,
      programDescription,
      userId,
      customerEmail,
      amount,
      currency: row.currency,
    });

    const admin = createAdminClient();
    await admin
      .from("academy_checkout_sessions")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkoutId);

    if (!session.url) {
      return { status: "unavailable", reason: "failed" };
    }

    return { status: "redirect", url: session.url };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}

export async function syncStripeCheckoutPayment(
  checkoutId: string,
  userId: string,
): Promise<StartStripeCheckoutResult> {
  const auth = await authorizeCheckoutOwner(checkoutId);
  if (!auth.ok) return { status: "unavailable", reason: auth.reason };
  if (auth.userId !== userId) return { status: "unavailable", reason: "not_found" };

  const { row } = auth;

  if (row.status === "paid" && row.enrollment_id) {
    const enrollment = await loadEnrollmentById(row.enrollment_id);
    if (enrollment) {
      return { status: "paid", enrollment };
    }
  }

  if (!row.stripe_checkout_session_id) {
    return { status: "unavailable", reason: "failed" };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id);

    if (session.payment_status !== "paid") {
      return { status: "unavailable", reason: "checkout_not_pending" };
    }

    await attachStripePaymentIntent(
      checkoutId,
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    );

    const fulfilled = await fulfillCheckoutById(checkoutId);
    if (!fulfilled.ok) {
      return { status: "unavailable", reason: fulfilled.reason };
    }

    return { status: "paid", enrollment: fulfilled.enrollment };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}
