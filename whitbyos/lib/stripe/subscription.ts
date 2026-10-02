import type Stripe from "stripe";
import { createServiceClient } from "@/base/lib/supabase/service";
import { planForPrice } from "@/whitbyos/lib/stripe/server";

/**
 * Writing a Stripe subscription onto the workspace it belongs to.
 *
 * Shared by every event that carries one, because created, updated and
 * deleted all say the same thing in the same shape: which plan, in what
 * state, until when. Handling them separately would be three places to get
 * the plan mapping wrong.
 */

/** How the workspace is found: the id we put on the subscription, then the customer. */
async function workspaceFor(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const tagged = subscription.metadata?.workspace_id;
  if (tagged) return tagged;

  const customer =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customer) return null;

  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", customer)
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}

/** The plan price on a subscription, ignoring the metered AI line beside it. */
function planPriceOf(subscription: Stripe.Subscription) {
  for (const item of subscription.items.data) {
    const price = item.price;
    // The AI line is metered; the plan line is licensed.
    if (price?.recurring?.usage_type === "metered") continue;
    if (price?.id) return price.id;
  }
  return null;
}

export async function applySubscription(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false as const, error: "Server credentials are missing." };

  const workspaceId = await workspaceFor(supabase, subscription);
  if (!workspaceId) {
    return { ok: false as const, error: "No workspace matches that Stripe customer." };
  }

  const priceId = planPriceOf(subscription);
  const plan = planForPrice(priceId);

  // A subscription that has ended puts the workspace into Inactive: not back
  // on Trial, which has been used and cannot be given again, and not left on
  // the plan it stopped paying for. Everything already made stays readable
  // and nothing new can be started until a plan is chosen.
  const ended = subscription.status === "canceled" || subscription.status === "incomplete_expired";

  // The cycle end moved onto the items. Reading it from the subscription
  // returned nothing, so the renewal date was blank on a live subscription.
  // Both items carry the same value; the first one is enough.
  const periodEnd =
    (subscription as unknown as { current_period_end?: number }).current_period_end ??
    (subscription.items.data[0] as unknown as { current_period_end?: number } | undefined)
      ?.current_period_end;

  const { error } = await supabase
    .from("workspaces")
    .update({
      stripe_subscription_id: ended ? null : subscription.id,
      subscription_status: subscription.status,
      plan_price_id: ended ? null : priceId,
      // While it is running, the plan only moves when Stripe names one we
      // recognise, so an unfamiliar price never silently downgrades somebody.
      // When it has ended, where it lands does not depend on the price at all.
      ...(ended ? { plan: "inactive" } : plan ? { plan } : {}),
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      subscription_started_at: subscription.start_date
        ? new Date(subscription.start_date * 1000).toISOString()
        : null,
    })
    .eq("id", workspaceId);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, workspaceId };
}

/** Checkout finishing is where a customer id first belongs to a workspace. */
export async function attachCustomer(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false as const, error: "Server credentials are missing." };

  const workspaceId = session.metadata?.workspace_id ?? session.client_reference_id ?? null;
  if (!workspaceId) return { ok: false as const, error: "That checkout named no workspace." };

  const customer =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  const { error } = await supabase
    .from("workspaces")
    .update({ stripe_customer_id: customer })
    .eq("id", workspaceId);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, workspaceId };
}
