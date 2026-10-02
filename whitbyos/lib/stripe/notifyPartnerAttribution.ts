import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/whitbyos/lib/stripe/server";

/**
 * Cross-module handoff to Partner Center (SRS §17.5.14).
 * Prefer in-process recordQualifyingAction — HTTP self-fetch on Vercel is
 * flaky (wrong host / same-isolate freeze). Academy checkout already does this.
 */

async function ownerUserIdForWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("owner_user_id")
    .eq("id", workspaceId)
    .maybeSingle();
  return (data?.owner_user_id as string | undefined) ?? null;
}

async function workspaceIdForCustomer(
  supabase: SupabaseClient,
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Prefer subscription metadata — customer id may not be attached yet on invoice.paid. */
async function workspaceIdForInvoice(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<string | null> {
  const customer =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  const fromCustomer = await workspaceIdForCustomer(supabase, customer);
  if (fromCustomer) return fromCustomer;

  const subRef = (
    invoice as Stripe.Invoice & {
      subscription?: string | { id?: string } | null;
    }
  ).subscription;
  const subId =
    typeof subRef === "string"
      ? subRef
      : subRef && typeof subRef === "object"
        ? subRef.id
        : null;
  if (!subId) return null;

  try {
    const subscription = await getStripe().subscriptions.retrieve(subId);
    const tagged = subscription.metadata?.workspace_id?.trim();
    if (tagged) return tagged;
  } catch (error) {
    console.error(
      "[whitby attribution] could not load subscription for invoice",
      subId,
      error,
    );
  }
  return null;
}

function paymentRefFromInvoice(invoice: Stripe.Invoice): string | null {
  const raw = invoice as Stripe.Invoice & {
    payment_intent?: string | { id?: string } | null;
  };
  const pi = raw.payment_intent;
  if (typeof pi === "string" && pi) return pi;
  if (pi && typeof pi === "object" && pi.id) return pi.id;
  return invoice.id ?? null;
}

function priceIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  for (const line of invoice.lines?.data ?? []) {
    const priced = line as Stripe.InvoiceLineItem & {
      price?: { id?: string } | null;
      pricing?: { price_details?: { price?: string } | null } | null;
    };
    if (priced.price?.id) return priced.price.id;
    const nested = priced.pricing?.price_details?.price;
    if (typeof nested === "string" && nested) return nested;
  }
  return undefined;
}

type WhitbyAttributionPayload = {
  referredUserId: string;
  qualifyingAction: string;
  commissionable: boolean;
  eventSource: "stripe" | "manual";
  externalPaymentId?: string;
  productId?: string;
  amountCollectedCents?: number;
  eventTimestamp?: string;
};

async function recordWhitbyAttribution(
  payload: WhitbyAttributionPayload,
): Promise<void> {
  try {
    const { createAdminClient } = await import(
      "@/partner-center/lib/supabase-admin"
    );
    const {
      recordQualifyingAction,
      promoteEarningsToPayable,
    } = await import("@/partner-center/lib/attribution");
    const partnerDb = createAdminClient();
    if (!partnerDb) {
      console.warn(
        "[whitby attribution] partner admin client unavailable; skipping.",
      );
      return;
    }

    const result = await recordQualifyingAction(partnerDb, {
      referredUserId: payload.referredUserId,
      product: "whitbyos",
      qualifyingAction: payload.qualifyingAction,
      commissionable: payload.commissionable,
      eventSource: payload.eventSource,
      externalPaymentId: payload.externalPaymentId,
      productId: payload.productId,
      amountCollectedCents: payload.amountCollectedCents,
      eventTimestamp: payload.eventTimestamp,
    });

    if (!result.ok) {
      console.error("[whitby attribution] in-process failed", result);
      return;
    }

    if (result.skipped) {
      console.info("[whitby attribution] skipped", result.reason, payload);
      return;
    }

    if (result.earningError) {
      console.error(
        "[whitby attribution] converted but earning failed",
        result.earningError,
        {
          referralId: result.referralId,
          eventId: result.eventId,
          referralStatus: result.referralStatus,
        },
      );
    }

    if (result.referralId) {
      const { data: profile } = await partnerDb
        .from("partner_referrals")
        .select("partner_profile_id")
        .eq("id", result.referralId)
        .maybeSingle();
      if (profile?.partner_profile_id) {
        try {
          await promoteEarningsToPayable(
            partnerDb,
            profile.partner_profile_id as string,
          );
        } catch (error) {
          console.error(
            "[whitby attribution] promoteEarningsToPayable failed",
            profile.partner_profile_id,
            error,
          );
        }
      }
    }
  } catch (error) {
    console.error("[whitby attribution] in-process error", error);
  }
}

/**
 * First collected subscription payment → Whitby converted (commissionable).
 * Open referrals only — renewals on already-converted rows are skipped upstream.
 */
export async function notifyPartnerPlatformInvoicePaid(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const amountCollectedCents = invoice.amount_paid ?? 0;
  if (amountCollectedCents <= 0) {
    console.info(
      "[whitby attribution] invoice.paid ignored (amount_paid <= 0)",
      invoice.id,
      amountCollectedCents,
    );
    return;
  }

  const workspaceId = await workspaceIdForInvoice(supabase, invoice);
  if (!workspaceId) {
    console.warn(
      "[whitby attribution] invoice.paid: no workspace for customer/subscription",
      invoice.id,
    );
    return;
  }

  const referredUserId = await ownerUserIdForWorkspace(supabase, workspaceId);
  if (!referredUserId) {
    console.warn(
      "[whitby attribution] invoice.paid: no owner for workspace",
      workspaceId,
    );
    return;
  }

  await recordWhitbyAttribution({
    referredUserId,
    qualifyingAction: "first_paid_subscription",
    commissionable: true,
    eventSource: "stripe",
    externalPaymentId: paymentRefFromInvoice(invoice) ?? undefined,
    productId: priceIdFromInvoice(invoice),
    amountCollectedCents,
    eventTimestamp: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : undefined,
  });
}

/**
 * Stripe subscription enters trial → Whitby in_progress (not commissionable).
 * Idempotent on subscription id as externalPaymentId.
 */
export async function notifyPartnerPlatformTrialStarted(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  if (subscription.status !== "trialing") return;

  const tagged = subscription.metadata?.workspace_id?.trim();
  const customer =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;
  const workspaceId =
    tagged || (await workspaceIdForCustomer(supabase, customer));
  if (!workspaceId) {
    console.warn(
      "[whitby attribution] trial: no workspace for subscription",
      subscription.id,
    );
    return;
  }

  const referredUserId = await ownerUserIdForWorkspace(supabase, workspaceId);
  if (!referredUserId) return;

  await recordWhitbyAttribution({
    referredUserId,
    qualifyingAction: "subscription_trial_started",
    commissionable: false,
    eventSource: "stripe",
    externalPaymentId: `trial:${subscription.id}`,
    eventTimestamp: subscription.start_date
      ? new Date(subscription.start_date * 1000).toISOString()
      : undefined,
  });
}

/**
 * Subscription becomes active (end trial / first paid period) → Converted.
 * Mirrors invoice.paid when that event was missed, arrived before the referral
 * existed, or never reached this deployment (common on localhost).
 * Uses the latest paid invoice with amount_paid > 0; idempotent on payment id.
 */
export async function notifyPartnerPlatformSubscriptionActivated(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<void> {
  if (subscription.status !== "active") return;

  let invoice: Stripe.Invoice | null = null;
  try {
    const listed = await getStripe().invoices.list({
      subscription: subscription.id,
      status: "paid",
      limit: 5,
    });
    invoice =
      listed.data.find((row) => (row.amount_paid ?? 0) > 0) ?? null;
  } catch (error) {
    console.error(
      "[whitby attribution] could not list paid invoices for subscription",
      subscription.id,
      error,
    );
    return;
  }

  if (!invoice) {
    console.info(
      "[whitby attribution] subscription.active: no paid invoice with amount yet",
      subscription.id,
    );
    return;
  }

  await notifyPartnerPlatformInvoicePaid(supabase, invoice);
}
