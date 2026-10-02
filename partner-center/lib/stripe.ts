import "server-only";

import Stripe from "stripe";

export type ConnectPaymentStatus = "ready" | "incomplete" | "on_hold";

let stripeClient: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in the environment.",
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2026-08-26.dahlia",
      typescript: true,
    });
  }
  return stripeClient;
}

export function stripeErrorMessage(caught: unknown, fallback: string) {
  if (caught instanceof Stripe.errors.StripeError) {
    return caught.message.split("\n")[0]?.trim() || caught.message;
  }
  if (caught instanceof Error) return caught.message;
  return fallback;
}

/** Stripe rejected account_update; only account_onboarding is valid for this account. */
export function stripeAccountUpdateNotAllowed(caught: unknown) {
  const message = stripeErrorMessage(caught, "");
  return (
    message.includes("account_update") &&
    message.includes("account_onboarding")
  );
}

/**
 * Stored Connect account is missing or belongs to another platform/key.
 * Caller should clear `stripe_connect_account_id` and recreate.
 */
export function stripeConnectAccountUnreachable(caught: unknown) {
  if (caught instanceof Stripe.errors.StripeError) {
    const code = (caught.code ?? "").toLowerCase();
    if (
      code === "resource_missing" ||
      code === "account_invalid" ||
      code === "platform_api_key_expired"
    ) {
      return true;
    }
  }
  const message = stripeErrorMessage(caught, "").toLowerCase();
  return (
    message.includes("permission denied") ||
    message.includes("does not have access") ||
    message.includes("does not have permission") ||
    message.includes("no such account") ||
    (message.includes("no such") && message.includes("account")) ||
    message.includes("could not be accessed")
  );
}

/**
 * Map a Connect Accounts v2 recipient account to payment_setup_status.
 * Ready when stripe_transfers is active and nothing is past-due.
 *
 * Fresh Express accounts are often `restricted` / pending until Stripe finishes
 * verifying — that is incomplete setup, not an account hold. Only past-due
 * requirements (or an explicit past-due transfer detail) become on_hold.
 */
export function mapAccountToPaymentStatus(
  account: Stripe.V2.Core.Account,
): ConnectPaymentStatus {
  const transfersStatus =
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status;
  const transferDetails =
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status_details ?? [];

  const entries = account.requirements?.entries ?? [];
  const pastDue = entries.some(
    (entry) => entry.minimum_deadline?.status === "past_due",
  );
  const transferPastDue = transferDetails.some(
    (detail) => detail.code === "requirements_past_due",
  );

  if (transferPastDue || (pastDue && transfersStatus !== "active")) {
    return "on_hold";
  }

  if (transfersStatus === "active") return "ready";
  return "incomplete";
}

/** Create an Express-style recipient Account (Accounts v2). */
export async function createExpressAccount(opts: {
  partnerProfileId: string;
  country?: string | null;
  email?: string | null;
  displayName?: string | null;
}) {
  const stripe = getStripe();
  const country = (opts.country?.trim() || "US").toLowerCase();

  return stripe.v2.core.accounts.create({
    contact_email: opts.email?.trim() || undefined,
    display_name: opts.displayName?.trim() || undefined,
    dashboard: "express",
    identity: {
      country,
    },
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    metadata: {
      partner_profile_id: opts.partnerProfileId,
    },
    include: ["configuration.recipient", "identity", "requirements"],
  });
}

export async function createAccountOnboardingLink(opts: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
  type?: "account_onboarding" | "account_update";
}) {
  const stripe = getStripe();
  const type = opts.type ?? "account_onboarding";
  const useCase =
    type === "account_update"
      ? {
          type: "account_update" as const,
          account_update: {
            configurations: ["recipient" as const],
            refresh_url: opts.refreshUrl,
            return_url: opts.returnUrl,
          },
        }
      : {
          type: "account_onboarding" as const,
          account_onboarding: {
            configurations: ["recipient" as const],
            refresh_url: opts.refreshUrl,
            return_url: opts.returnUrl,
          },
        };

  return stripe.v2.core.accountLinks.create({
    account: opts.accountId,
    use_case: useCase,
  });
}

export async function retrieveConnectAccount(accountId: string) {
  return getStripe().v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient", "identity", "requirements"],
  });
}
