import "server-only";
import { createClient } from "@/base/lib/supabase/server";
import { siteUrl } from "@/base/auth/site";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getSessionProfile } from "@/base/identity/session";
import { TRIAL_DAYS, planFor } from "@/whitbyos/lib/billing-vocab";
import { getStripe, pricesFor, stripeConfigured } from "@/whitbyos/lib/stripe/server";

/**
 * Buying a plan.
 *
 * Two line items, always: the plan itself, and the metered AI price that
 * rides alongside it. The meter is billed on real usage, so its line carries
 * no quantity; Stripe fills that in from what gets reported.
 *
 * The fourteen days are `trial_period_days` on the plan somebody chooses, not
 * a product of their own. Only offered to a workspace that has not had one:
 * a second trial on the same workspace would be a way to never pay.
 */
export type CheckoutOutcome =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * What happened to a plan change: off to Stripe to buy one, or changed on the
 * subscription that already exists.
 */
export type PlanChangeOutcome =
  | { ok: true; url: string }
  | { ok: true; changed: true }
  | { ok: false; error: string };

/** A subscription Stripe still considers live, so it can be changed rather than replaced. */
const LIVE = new Set(["trialing", "active", "past_due", "unpaid"]);

export async function startCheckout(plan: string): Promise<CheckoutOutcome> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Billing is not configured on this deployment yet." };
  }

  const known = planFor(plan);
  if (!known) return { ok: false, error: "That is not a plan Whitby sells." };

  const { planPrice, aiPrice } = pricesFor(plan);
  if (!planPrice) {
    return {
      ok: false,
      error:
        known.billing === "custom"
          ? `${known.label} is quoted by hand. Contact your account team to arrange it.`
          : `${known.label} has no price set up in Stripe yet.`,
    };
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();
  const [{ data: workspace }, profile] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, stripe_customer_id, trial_ends_at, stripe_subscription_id")
      .eq("id", workspaceId)
      .maybeSingle(),
    getSessionProfile(),
  ]);

  if (!workspace) return { ok: false, error: "No workspace found." };

  const stripe = getStripe();
  const back = `${siteUrl()}/whitbyos/settings/billing`;

  const lineItems: { price: string; quantity?: number }[] = [{ price: planPrice, quantity: 1 }];
  // Metered prices take no quantity; Stripe refuses the session if given one.
  if (aiPrice) lineItems.push({ price: aiPrice });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      // Reuse the customer where the workspace already has one, so a second
      // purchase does not create a second customer for the same people.
      ...(workspace.stripe_customer_id
        ? { customer: workspace.stripe_customer_id as string }
        : { customer_email: profile?.user.email ?? undefined }),
      client_reference_id: workspaceId,
      metadata: { workspace_id: workspaceId, plan },
      subscription_data: {
        metadata: { workspace_id: workspaceId, plan },
        ...(workspace.trial_ends_at || workspace.stripe_subscription_id
          ? {}
          : { trial_period_days: TRIAL_DAYS }),
      },
      success_url: `${back}?checkout=done`,
      cancel_url: `${back}?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) return { ok: false, error: "Stripe returned no checkout page." };
    return { ok: true, url: session.url };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : "Stripe refused the checkout.",
    };
  }
}

/**
 * Move an existing subscription onto another plan.
 *
 * `startCheckout` creates a subscription, which is right for a first purchase
 * and wrong for every one after it: run against a workspace that already pays,
 * it left two live subscriptions on the same customer and billed for both. It
 * even read `stripe_subscription_id` — only to decide whether to grant a trial
 * — and created a second one anyway.
 *
 * So a workspace that already has a live subscription gets its items swapped in
 * place. The subscription keeps its id, its customer, its billing anchor and,
 * importantly, its trial.
 *
 * ON A TRIAL, NOTHING IS CHARGED.
 * A trialing subscription has not been invoiced for this period, so there is
 * nothing to prorate and `create_prorations` would be inventing a credit
 * against a payment nobody made. Proration is asked for only once the
 * subscription is actually billing. Either way `trial_end` is left alone, so
 * moving from Standard to Professional mid-trial keeps the days that are left
 * rather than restarting or ending them.
 */
export async function changeSubscriptionPlan(plan: string): Promise<PlanChangeOutcome> {
  const { planPrice, aiPrice } = pricesFor(plan);
  if (!planPrice) return { ok: false, error: "That plan has no price set up in Stripe." };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_subscription_id")
    .eq("id", workspaceId)
    .maybeSingle();

  const subscriptionId = workspace?.stripe_subscription_id as string | null | undefined;
  if (!subscriptionId) return { ok: false, error: "This workspace has no subscription." };

  const stripe = getStripe();

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    // A cancelled or dead subscription is not something to edit. The caller
    // falls back to buying a new one.
    if (!LIVE.has(subscription.status)) {
      return { ok: false, error: "This subscription is no longer live." };
    }

    // Prices are swapped on the items that are already there rather than the
    // items being deleted and re-added: the metered line carries this
    // subscription's usage for the period, and removing it would take that
    // with it.
    const items = subscription.items.data.map((item) => {
      const metered = item.price.recurring?.usage_type === "metered";
      const price = metered ? aiPrice : planPrice;
      return price ? { id: item.id, price } : { id: item.id };
    });

    await stripe.subscriptions.update(subscriptionId, {
      items,
      // Nothing has been billed during a trial, so there is nothing to
      // prorate; asking for prorations there produces credits against a
      // payment that never happened.
      proration_behavior:
        subscription.status === "trialing" ? "none" : "create_prorations",
      metadata: { workspace_id: workspaceId, plan },
    });

    // `customer.subscription.updated` follows and writes the new plan to the
    // workspace, the same path a first purchase takes.
    return { ok: true, changed: true };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : "Stripe refused the plan change.",
    };
  }
}

/**
 * Buy a plan, or move to it, whichever this workspace needs.
 *
 * The one entry point for changing plan, so no caller has to know which of the
 * two it is — which is how the duplicate-subscription bug got in.
 */
export async function startPlanChange(plan: string): Promise<PlanChangeOutcome> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_subscription_id, subscription_status")
    .eq("id", workspaceId)
    .maybeSingle();

  const hasLive =
    Boolean(workspace?.stripe_subscription_id) &&
    LIVE.has(String(workspace?.subscription_status ?? ""));

  if (hasLive) {
    const changed = await changeSubscriptionPlan(plan);
    // A subscription Stripe no longer considers live falls through to buying
    // one, rather than dead-ending on a row that is out of date.
    if (changed.ok || changed.error !== "This subscription is no longer live.") {
      return changed;
    }
  }

  return startCheckout(plan);
}

/**
 * The Stripe billing portal, where an existing subscription is changed or
 * cancelled. Stripe hosts it, so card details never reach Whitby.
 */
export async function openBillingPortal(): Promise<CheckoutOutcome> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Billing is not configured on this deployment yet." };
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", workspaceId)
    .maybeSingle();

  const customer = workspace?.stripe_customer_id as string | null | undefined;
  if (!customer) return { ok: false, error: "This workspace has no billing account yet." };

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${siteUrl()}/whitbyos/settings/billing`,
    });
    return { ok: true, url: session.url };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : "Stripe refused to open the portal.",
    };
  }
}
