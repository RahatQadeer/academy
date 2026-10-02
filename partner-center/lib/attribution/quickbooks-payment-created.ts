import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { recordOpportunityPayment } from "@/partner-center/lib/attribution/record-opportunity-payment";
import { resolveOpportunityForPayment } from "@/partner-center/lib/attribution/resolve-opportunity-for-payment";
import {
  dollarsToCents,
  fetchQbCustomer,
  fetchQbInvoice,
  fetchQbPayment,
  invoiceIdFromPayment,
  opportunityIdFromQbText,
  stripeRefsInText,
  type QbCustomer,
  type QbInvoice,
  type QbPayment,
} from "@/partner-center/lib/quickbooks/api";
import { getValidQuickBooksAccessToken } from "@/partner-center/lib/quickbooks/credentials";
import { createPartnerAdminNotification } from "@/super-admin/partner-center/lib/notifications/create-notification";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export type QuickBooksPaymentCreatedResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  eventId?: string;
  earningId?: string;
  opportunityId?: string;
};

function paymentTimestamp(payment: QbPayment): Date {
  if (payment.TxnDate) {
    const parsed = Date.parse(`${payment.TxnDate}T12:00:00.000Z`);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  if (payment.MetaData?.CreateTime) {
    const parsed = Date.parse(payment.MetaData.CreateTime);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return new Date();
}

function customFieldTexts(invoice: QbInvoice | null): string[] {
  return (invoice?.CustomField ?? [])
    .map((field) => field.StringValue)
    .filter((value): value is string => Boolean(value));
}

async function alreadyAttributedStripeRef(
  supabase: SupabaseClient,
  refs: string[],
): Promise<boolean> {
  if (refs.length === 0) return false;
  const { data } = await supabase
    .from("partner_attribution_events")
    .select("id")
    .in("external_payment_id", refs)
    .limit(1);
  return Boolean(data?.length);
}

function looksStripeSynced(
  payment: QbPayment,
  invoice: QbInvoice | null,
  customer: QbCustomer | null,
): string[] {
  return stripeRefsInText(
    payment.PrivateNote,
    payment.PaymentRefNum,
    invoice?.PrivateNote,
    invoice?.CustomerMemo?.value,
    customer?.Notes,
    ...customFieldTexts(invoice),
  );
}

async function notifyUnmatched(input: {
  paymentId: string;
  amountCents: number;
  email: string | null;
}): Promise<void> {
  const amount = (input.amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  await createPartnerAdminNotification({
    kind: "payment_unmatched",
    title: "QuickBooks payment unmatched",
    body: `${amount} payment ${input.paymentId}${
      input.email ? ` (${input.email})` : ""
    } — no eligible opportunity.`,
    href: PC_ADMIN.opportunities,
    entityType: "payment_unmatched",
    entityId: null,
  });
}

export async function handleQuickBooksPaymentCreated(
  supabase: SupabaseClient,
  input: { paymentId: string; realmId?: string | null },
): Promise<QuickBooksPaymentCreatedResult> {
  const auth = await getValidQuickBooksAccessToken(supabase);
  if (!auth) {
    return {
      ok: false,
      error: "QuickBooks is not connected or tokens could not be refreshed.",
    };
  }

  if (input.realmId && input.realmId !== auth.realmId) {
    return {
      ok: true,
      skipped: true,
      reason: "Webhook realm does not match connected QuickBooks company.",
    };
  }

  const paymentResult = await fetchQbPayment(
    auth.accessToken,
    auth.realmId,
    input.paymentId,
  );
  if (paymentResult.error || !paymentResult.payment) {
    return {
      ok: false,
      error: paymentResult.error ?? "Could not load QuickBooks payment.",
    };
  }

  const payment = paymentResult.payment;
  const amountCollectedCents = dollarsToCents(payment.TotalAmt);
  if (amountCollectedCents <= 0) {
    return {
      ok: true,
      skipped: true,
      reason: "Payment amount is zero.",
    };
  }

  const invoiceId = invoiceIdFromPayment(payment);
  let invoice: QbInvoice | null = null;
  if (invoiceId) {
    const invoiceResult = await fetchQbInvoice(
      auth.accessToken,
      auth.realmId,
      invoiceId,
    );
    if (invoiceResult.invoice) invoice = invoiceResult.invoice;
  }

  const customerId =
    payment.CustomerRef?.value ?? invoice?.CustomerRef?.value ?? null;
  let customer: QbCustomer | null = null;
  if (customerId) {
    const customerResult = await fetchQbCustomer(
      auth.accessToken,
      auth.realmId,
      customerId,
    );
    if (customerResult.customer) customer = customerResult.customer;
  }

  const stripeRefs = looksStripeSynced(payment, invoice, customer);
  const stripePaymentRefs = stripeRefs.filter(
    (ref) => ref.startsWith("pi_") || ref.startsWith("ch_"),
  );
  if (stripePaymentRefs.length > 0) {
    return {
      ok: true,
      skipped: true,
      reason: "Payment appears Stripe-synced; skipped to avoid double-count.",
    };
  }
  if (await alreadyAttributedStripeRef(supabase, stripeRefs)) {
    return {
      ok: true,
      skipped: true,
      reason: "Stripe payment id already attributed; skipped QuickBooks duplicate.",
    };
  }

  const eventTime = paymentTimestamp(payment);
  const opportunityHint = opportunityIdFromQbText(
    payment.PrivateNote,
    payment.PaymentRefNum,
    invoice?.PrivateNote,
    invoice?.CustomerMemo?.value,
    customer?.Notes,
    ...customFieldTexts(invoice),
  );
  const billingEmail =
    customer?.PrimaryEmailAddr?.Address?.trim().toLowerCase() ?? null;

  const resolved = await resolveOpportunityForPayment(supabase, {
    opportunityId: opportunityHint,
    billingEmail,
    eventTime,
  });

  if (!resolved) {
    await notifyUnmatched({
      paymentId: payment.Id,
      amountCents: amountCollectedCents,
      email: billingEmail,
    });
    return {
      ok: true,
      skipped: true,
      reason: "No eligible opportunity matched for this payment.",
    };
  }

  const externalPaymentId = `qbo_payment_${payment.Id}`;
  const result = await recordOpportunityPayment(supabase, {
    opportunityId: resolved.opportunityId,
    externalPaymentId,
    amountCollectedCents,
    eventSource: "quickbooks",
    eventTimestamp: eventTime.toISOString(),
  });

  await supabase
    .from("partner_integration_credentials")
    .update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "quickbooks");

  return {
    ...result,
    opportunityId: resolved.opportunityId,
  };
}
