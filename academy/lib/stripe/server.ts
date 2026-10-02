import "server-only";

import Stripe from "stripe";

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Prefer Academy-scoped secret; fall back to shared name for older env files. */
export function getStripeWebhookSecret() {
  return (
    process.env.STRIPE_ACADEMY_WEBHOOK_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

export function isStripeWebhookConfigured() {
  return Boolean(getStripeWebhookSecret());
}

let stripeClient: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }

  return stripeClient;
}

export function stripeAmountCents(amount: number) {
  return Math.round(amount * 100);
}
