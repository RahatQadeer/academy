import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { computeCommissionAmount } from "@/partner-center/lib/attribution/commission-math";
import {
  checkEarningBasisAndPeriod,
  daysBetween,
} from "@/partner-center/lib/attribution/earning-eligibility";
import {
  netEligibleCollectedCents,
  parseEligibleRevenueRules,
} from "@/partner-center/lib/attribution/eligible-revenue";
import { loadCommissionRules } from "@/partner-center/lib/attribution/pick-commission-rule";
import { findAttributionEventByPaymentId } from "@/partner-center/lib/attribution/resolve-referral";
import {
  getStripe,
  stripeConfigured,
  stripeErrorMessage,
} from "@/partner-center/lib/stripe";
import type {
  StripeOpportunityMatchMethod,
  ValidateStripeOpportunityPaymentResult,
} from "@/super-admin/partner-center/opportunities/lib/validate-stripe-opportunity-payment-types";

export type {
  StripeOpportunityMatchMethod,
  ValidateStripeOpportunityPaymentResult,
} from "@/super-admin/partner-center/opportunities/lib/validate-stripe-opportunity-payment-types";

function normalizeName(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed || trimmed === "—") return "";
  return trimmed;
}

function namesMatch(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right;
}

function emailsMatch(a: string | null | undefined, b: string | null | undefined) {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}

function opportunityIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): string | null {
  const raw =
    metadata?.partner_opportunity_id ?? metadata?.partnerOpportunityId ?? null;
  return raw?.trim() || null;
}

function idFromExpandable(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && value.id) return value.id;
  return null;
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

async function countPriorCommissionableEarnings(
  supabase: SupabaseClient,
  input: { partnerProfileId: string; opportunityId: string },
): Promise<number> {
  const { data: events } = await supabase
    .from("partner_attribution_events")
    .select("id")
    .eq("partner_profile_id", input.partnerProfileId)
    .eq("opportunity_id", input.opportunityId);

  const eventIds = (events ?? []).map((row) => row.id as string);
  if (eventIds.length === 0) return 0;

  const { data: earnings } = await supabase
    .from("partner_earnings")
    .select("id, status")
    .in("attribution_event_id", eventIds)
    .not("status", "in", '("ineligible","reversed")');

  return (earnings ?? []).length;
}

async function previewEnterpriseCommission(
  supabase: SupabaseClient,
  input: {
    partnerProfileId: string;
    opportunityId: string;
    amountCollectedCents: number;
    eventTime: Date;
  },
): Promise<{ amountUsd: number | null; note: string | null }> {
  const rule = await loadCommissionRules(
    supabase,
    input.partnerProfileId,
    "enterprise",
  );
  if (!rule) {
    return {
      amountUsd: null,
      note: "No commission owed under current rules (no enterprise commission rule).",
    };
  }

  const { data: opportunity } = await supabase
    .from("partner_opportunities")
    .select("accepted_at, created_at")
    .eq("id", input.opportunityId)
    .maybeSingle();

  const conversionDateIso =
    (opportunity?.accepted_at as string | null) ||
    (opportunity?.created_at as string | null) ||
    null;

  const priorCount = await countPriorCommissionableEarnings(supabase, {
    partnerProfileId: input.partnerProfileId,
    opportunityId: input.opportunityId,
  });

  const daysSinceConversion = conversionDateIso
    ? daysBetween(conversionDateIso, input.eventTime)
    : 0;

  const basisCheck = checkEarningBasisAndPeriod({
    basis: rule.earning_basis,
    eligiblePeriod: rule.eligible_period,
    priorCommissionableCount: priorCount,
    daysSinceConversion,
  });

  if (!basisCheck.ok) {
    return {
      amountUsd: null,
      note:
        basisCheck.reason ??
        "No commission owed under current rules (earning basis / period).",
    };
  }

  const revenueRules = parseEligibleRevenueRules(rule.eligible_revenue_rules);
  const netCents = netEligibleCollectedCents(
    input.amountCollectedCents,
    revenueRules,
  );

  const amount = computeCommissionAmount(
    rule,
    netCents ?? input.amountCollectedCents,
  );
  if (amount == null || amount <= 0) {
    return {
      amountUsd: null,
      note: "No commission owed under current rules.",
    };
  }

  return { amountUsd: amount, note: null };
}

async function loadOpportunityContext(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<
  | {
      ok: true;
      partnerProfileId: string;
      companyName: string;
      contactEmail: string | null;
      partnerName: string;
    }
  | { ok: false; error: string }
> {
  const { data: row, error } = await supabase
    .from("partner_opportunities")
    .select("id, partner_profile_id, company_id, primary_contact_id")
    .eq("id", opportunityId)
    .maybeSingle();

  if (error || !row?.id) {
    return { ok: false, error: "Opportunity not found." };
  }

  let companyName = "";
  if (row.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", row.company_id as string)
      .maybeSingle();
    companyName = ((company?.name as string | undefined) ?? "").trim();
  }

  let contactEmail: string | null = null;
  if (row.primary_contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("email")
      .eq("id", row.primary_contact_id as string)
      .maybeSingle();
    contactEmail = ((contact?.email as string | null) ?? null)?.trim() || null;
  }

  const { data: partnerProfile } = await supabase
    .from("partner_profiles")
    .select("id, company_id, application_data")
    .eq("id", row.partner_profile_id as string)
    .maybeSingle();

  let partnerName = "Partner";
  if (partnerProfile) {
    const app =
      partnerProfile.application_data &&
      typeof partnerProfile.application_data === "object" &&
      !Array.isArray(partnerProfile.application_data)
        ? (partnerProfile.application_data as Record<string, unknown>)
        : {};
    const legalName =
      typeof app.legal_name === "string" ? app.legal_name.trim() : "";
    if (partnerProfile.company_id) {
      const { data: partnerCompany } = await supabase
        .from("companies")
        .select("name")
        .eq("id", partnerProfile.company_id as string)
        .maybeSingle();
      partnerName =
        ((partnerCompany?.name as string | undefined) ?? "").trim() ||
        legalName ||
        "Partner";
    } else {
      partnerName = legalName || "Partner";
    }
  }

  return {
    ok: true,
    partnerProfileId: row.partner_profile_id as string,
    companyName,
    contactEmail,
    partnerName,
  };
}

function paymentIntentIdFromInvoicePayment(
  payment: Stripe.InvoicePayment,
): string | null {
  const nested = payment.payment;
  if (!nested) return null;
  if (nested.type === "payment_intent") {
    return idFromExpandable(nested.payment_intent);
  }
  if (nested.type === "charge") {
    const charge = nested.charge;
    if (charge && typeof charge === "object" && "payment_intent" in charge) {
      return idFromExpandable(charge.payment_intent);
    }
  }
  return null;
}

async function findInvoiceIdForPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<string | null> {
  const listed = await stripe.invoicePayments.list({
    payment: {
      type: "payment_intent",
      payment_intent: paymentIntentId,
    },
    limit: 1,
  });
  const first = listed.data[0];
  if (!first) return null;
  return idFromExpandable(first.invoice);
}

async function loadSucceededPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<
  | { ok: true; pi: Stripe.PaymentIntent; amountCents: number }
  | { ok: false; error: string }
> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const collected = pi.amount_received || pi.amount || 0;
  if (pi.status !== "succeeded" || collected <= 0) {
    return {
      ok: false,
      error: "Stripe PaymentIntent is not a collected (succeeded) payment.",
    };
  }
  return { ok: true, pi, amountCents: collected };
}

async function resolvePaymentFromInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<
  | {
      ok: true;
      resolvedPaymentId: string;
      paymentAmountCents: number;
      eventTimestamp: string;
    }
  | { ok: false; error: string }
> {
  const payments =
    invoice.payments?.data ??
    (
      await stripe.invoicePayments.list({
        invoice: invoice.id,
        status: "paid",
        limit: 10,
      })
    ).data;

  const paid = payments.filter((row) => row.status === "paid");
  if (paid.length === 0) {
    return {
      ok: false,
      error: "Could not resolve a PaymentIntent or Charge for this invoice.",
    };
  }

  for (const row of paid) {
    const piId = paymentIntentIdFromInvoicePayment(row);
    if (!piId) continue;
    const loaded = await loadSucceededPaymentIntent(stripe, piId);
    if (!loaded.ok) continue;
    if (loaded.amountCents === (invoice.amount_paid ?? 0)) {
      return {
        ok: true,
        resolvedPaymentId: loaded.pi.id,
        paymentAmountCents: loaded.amountCents,
        eventTimestamp: new Date(loaded.pi.created * 1000).toISOString(),
      };
    }
  }

  // Fall back to first paid payment intent for a clear amount-mismatch error.
  for (const row of paid) {
    const piId = paymentIntentIdFromInvoicePayment(row);
    if (!piId) continue;
    const loaded = await loadSucceededPaymentIntent(stripe, piId);
    if (!loaded.ok) continue;
    return {
      ok: true,
      resolvedPaymentId: loaded.pi.id,
      paymentAmountCents: loaded.amountCents,
      eventTimestamp: new Date(loaded.pi.created * 1000).toISOString(),
    };
  }

  return {
    ok: false,
    error: "Could not resolve a PaymentIntent or Charge for this invoice.",
  };
}

async function resolveInvoiceAndPayment(
  rawId: string,
): Promise<
  | {
      ok: true;
      invoice: Stripe.Invoice;
      resolvedPaymentId: string;
      paymentAmountCents: number;
      eventTimestamp: string;
      customerName: string;
      customerEmail: string | null;
    }
  | { ok: false; error: string }
> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Stripe is not configured." };
  }

  const trimmed = rawId.trim();
  if (
    !trimmed.startsWith("in_") &&
    !trimmed.startsWith("pi_") &&
    !trimmed.startsWith("ch_")
  ) {
    return {
      ok: false,
      error:
        "Stripe id must be an Invoice (in_…), PaymentIntent (pi_…), or Charge (ch_…).",
    };
  }

  try {
    const stripe = getStripe();
    let invoiceId: string | null = null;
    let paymentAmountCents: number | null = null;
    let resolvedPaymentId: string | null = null;
    let eventTimestamp: string | null = null;

    if (trimmed.startsWith("pi_")) {
      const loaded = await loadSucceededPaymentIntent(stripe, trimmed);
      if (!loaded.ok) return loaded;
      paymentAmountCents = loaded.amountCents;
      resolvedPaymentId = loaded.pi.id;
      eventTimestamp = new Date(loaded.pi.created * 1000).toISOString();
      invoiceId = await findInvoiceIdForPaymentIntent(stripe, loaded.pi.id);
      if (!invoiceId) {
        return {
          ok: false,
          error: "That PaymentIntent is not linked to a Stripe invoice.",
        };
      }
    } else if (trimmed.startsWith("ch_")) {
      const charge = await stripe.charges.retrieve(trimmed);
      if (!charge.paid || (charge.amount ?? 0) <= 0) {
        return {
          ok: false,
          error: "Stripe Charge is not a collected (paid) payment.",
        };
      }
      paymentAmountCents = charge.amount;
      const piId = idFromExpandable(charge.payment_intent);
      resolvedPaymentId = piId || charge.id;
      eventTimestamp = new Date(charge.created * 1000).toISOString();
      if (!piId) {
        return {
          ok: false,
          error: "That Charge is not linked to a PaymentIntent or invoice.",
        };
      }
      invoiceId = await findInvoiceIdForPaymentIntent(stripe, piId);
      if (!invoiceId) {
        return {
          ok: false,
          error: "That Charge is not linked to a Stripe invoice.",
        };
      }
    } else {
      invoiceId = trimmed;
    }

    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ["customer", "payments.data.payment.payment_intent"],
    });

    if (invoice.status !== "paid" || (invoice.amount_paid ?? 0) <= 0) {
      return {
        ok: false,
        error: `Invoice is unpaid (status: ${invoice.status ?? "unknown"}). Only paid invoices can be recorded.`,
      };
    }

    if (!resolvedPaymentId || paymentAmountCents == null) {
      const fromInvoice = await resolvePaymentFromInvoice(stripe, invoice);
      if (!fromInvoice.ok) return fromInvoice;
      resolvedPaymentId = fromInvoice.resolvedPaymentId;
      paymentAmountCents = fromInvoice.paymentAmountCents;
      eventTimestamp = fromInvoice.eventTimestamp;
    }

    const invoicePaid = invoice.amount_paid ?? 0;
    if (invoicePaid !== paymentAmountCents) {
      return {
        ok: false,
        error: `Invoice amount paid (${formatUsd(invoicePaid)}) does not match the payment amount (${formatUsd(paymentAmountCents)}). Partial payments or credits cannot be recorded this way.`,
      };
    }

    let customerName =
      (invoice.customer_name ?? "").trim() ||
      (invoice.customer_email ?? "").trim();
    let customerEmail = (invoice.customer_email ?? "").trim() || null;

    const customer = invoice.customer;
    if (
      customer &&
      typeof customer === "object" &&
      !("deleted" in customer && customer.deleted)
    ) {
      const cust = customer as Stripe.Customer;
      if (!customerName) {
        customerName = (cust.name ?? "").trim() || (cust.email ?? "").trim();
      }
      if (!customerEmail) {
        customerEmail = (cust.email ?? "").trim() || null;
      }
    }

    return {
      ok: true,
      invoice,
      resolvedPaymentId,
      paymentAmountCents: invoicePaid,
      eventTimestamp: eventTimestamp ?? new Date().toISOString(),
      customerName: customerName || "—",
      customerEmail,
    };
  } catch (caught) {
    return {
      ok: false,
      error: stripeErrorMessage(
        caught,
        "Could not load that Stripe invoice or payment. Check the id and try again.",
      ),
    };
  }
}

/**
 * Shared Stripe opportunity payment validation for admin Validate + Record.
 * Does not create attribution events or earnings.
 */
export async function validateStripeOpportunityPayment(
  supabase: SupabaseClient,
  input: { opportunityId: string; paymentId: string },
): Promise<ValidateStripeOpportunityPaymentResult> {
  const paymentId = input.paymentId.trim();
  if (!paymentId) {
    return { ok: false, error: "Stripe payment id is required." };
  }

  const opportunity = await loadOpportunityContext(
    supabase,
    input.opportunityId,
  );
  if (!opportunity.ok) return opportunity;

  const resolved = await resolveInvoiceAndPayment(paymentId);
  if (!resolved.ok) return resolved;

  const existing = await findAttributionEventByPaymentId(
    supabase,
    resolved.resolvedPaymentId,
  );
  if (existing?.id) {
    return {
      ok: false,
      error: `Payment ${resolved.resolvedPaymentId} was already recorded.`,
    };
  }

  const metaOpportunityId = opportunityIdFromMetadata(resolved.invoice.metadata);
  let matchMethod: StripeOpportunityMatchMethod | null = null;

  if (metaOpportunityId) {
    if (metaOpportunityId !== input.opportunityId) {
      return {
        ok: false,
        error: `Invoice belongs to another opportunity (${metaOpportunityId}).`,
      };
    }
    matchMethod = "metadata";
  } else if (namesMatch(resolved.customerName, opportunity.companyName)) {
    matchMethod = "company_name";
  } else if (emailsMatch(resolved.customerEmail, opportunity.contactEmail)) {
    matchMethod = "email";
  } else {
    return {
      ok: false,
      error: `Invoice does not match this opportunity. Invoice customer: "${resolved.customerName || "—"}"; opportunity company: "${opportunity.companyName || "—"}".`,
    };
  }

  const eventTime = new Date(resolved.eventTimestamp);
  const commission = await previewEnterpriseCommission(supabase, {
    partnerProfileId: opportunity.partnerProfileId,
    opportunityId: input.opportunityId,
    amountCollectedCents: resolved.paymentAmountCents,
    eventTime,
  });

  return {
    ok: true,
    resolvedPaymentId: resolved.resolvedPaymentId,
    invoiceId: resolved.invoice.id,
    amountCollectedCents: resolved.paymentAmountCents,
    invoiceStatus: resolved.invoice.status ?? "unknown",
    customerName: resolved.customerName || "—",
    opportunityCompanyName: opportunity.companyName || "—",
    partnerName: opportunity.partnerName,
    commissionOwedUsd: commission.amountUsd,
    commissionNote: commission.note,
    matchMethod,
    eventTimestamp: resolved.eventTimestamp,
  };
}
