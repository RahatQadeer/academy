import "server-only";
import { createServiceClient } from "@/base/lib/supabase/service";
import { aiChargeMicros } from "@/whitbyos/lib/ai/cost";
import { geminiCostMicros, MICROS_PER_CENT, type GeminiUsage } from "@/whitbyos/lib/ai/pricing";
import { AI_METER_EVENT, getStripe, stripeConfigured } from "@/whitbyos/lib/stripe/server";

type ReportRow = {
  id: string;
  from_cents: number;
  to_cents: number;
  units: number;
  identifier: string;
  attempts: number;
};

/**
 * Every generation, written down: what the model did, what it cost, what we
 * charge for it.
 *
 * Written with the service key rather than the caller's client. Usage is a fact
 * about the workspace, not something a member may edit, and the `_read` policy
 * on the table lets them see it without being able to write it.
 *
 * Nothing here throws. Billing must never be the reason a professional's
 * drafting fails: a usage row that cannot be written is a row we lose, which is
 * a smaller problem than a Work Plan that would not draft.
 */
export async function recordAiUsage(input: {
  workspaceId: string;
  usage: GeminiUsage;
  /** Which part of the product spent this. */
  feature: string;
}): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  const costMicros = geminiCostMicros(input.usage);
  const charge = aiChargeMicros(costMicros);

  try {
    await supabase.from("whitbyos_ai_usage").insert({
      workspace_id: input.workspaceId,
      feature: input.feature,
      model: input.usage.model,
      prompt_tokens: input.usage.promptTokens,
      output_tokens: input.usage.outputTokens,
      total_tokens: input.usage.totalTokens,
      // All null while token pricing is unconfigured. The tokens are still
      // recorded, so once the rates are set the history can be priced.
      cost_micros: charge?.costMicros ?? null,
      profit_micros: charge?.profitMicros ?? null,
      charge_micros: charge?.chargeMicros ?? null,
      markup_rate: charge?.markupRate ?? null,
      cost_cents: charge ? Math.round(charge.costMicros / MICROS_PER_CENT) : null,
      // Whole cents actually reported for this row. Reporting accumulates
      // across rows, so a single call almost always contributes zero.
      units: 0,
    });
  } catch {
    return;
  }

  // Metered billing wants usage during the period it belongs to, not swept up
  // afterwards, so this is the moment to offer it. It is cheap in the usual
  // case: a generation is worth about half a cent, so most calls find nothing
  // whole to send and stop before reaching Stripe.
  reportAiUsageInBackground(input.workspaceId);
}

/**
 * Hand Stripe the whole cents this workspace owes that it has not been sent.
 *
 * The meter bills $0.01 a unit, so a unit is a cent, and one generation is
 * worth a fraction of one. Reporting each call individually would mean either
 * rounding every one up to a cent — an overcharge of more than tenfold — or
 * reporting zero forever. So charges accumulate in micro-dollars and only whole
 * cents are ever reported.
 *
 * CLAIM, THEN SEND.
 * The amount is written down as a closed range of cumulative cents before it
 * goes to Stripe, and a retry re-sends that range rather than recomputing it.
 * Recomputing is what double-charges: send 3, Stripe accepts, the watermark
 * write fails, more usage arrives, and the retry sends 5 on top of the 3.
 *
 * Three things then have to hold, and each has its own guard:
 *   - the same cents are never claimed twice — a partial unique index allows
 *     one pending report per workspace, so a second call joins the first;
 *   - a report that landed is not counted again — the identifier is derived
 *     from the range, and Stripe deduplicates on it;
 *   - usage is never lost — the watermark advances only after Stripe accepts,
 *     and a failure leaves the row pending for the next attempt.
 */
export async function reportAiUsageToStripe(
  workspaceId: string,
): Promise<{ ok: true; reportedCents: number } | { ok: false; reason: string }> {
  if (!stripeConfigured()) return { ok: false, reason: "Stripe is not configured." };
  if (!process.env.STRIPE_AI_METER_ID?.trim()) {
    return { ok: false, reason: "No AI meter is configured." };
  }

  const supabase = createServiceClient();
  if (!supabase) return { ok: false, reason: "No service client." };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", workspaceId)
    .maybeSingle();

  const customer = workspace?.stripe_customer_id as string | null;
  // Usage still accrues for a workspace with no Stripe customer; it simply has
  // nowhere to be reported until one exists.
  if (!customer) return { ok: false, reason: "This workspace has no Stripe customer." };

  // An unresolved report is finished before a new one is opened. Anything else
  // would leave two claims on overlapping cents.
  const { data: pending } = await supabase
    .from("whitbyos_ai_meter_reports")
    .select("id, from_cents, to_cents, units, identifier, attempts")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .maybeSingle();

  let report = pending as ReportRow | null;

  if (!report) {
    const { data: owedRaw } = await supabase.rpc("whitbyos_ai_owed_cents", {
      p_workspace_id: workspaceId,
    });
    const owed = Number(owedRaw ?? 0);

    const { data: state } = await supabase
      .from("whitbyos_ai_meter_state")
      .select("reported_cents")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const reported = Number(state?.reported_cents ?? 0);
    // Under a cent of new usage: nothing to send, and the remainder stays in
    // the usage rows rather than being rounded away.
    if (owed <= reported) return { ok: true, reportedCents: 0 };

    const { data: created, error } = await supabase
      .from("whitbyos_ai_meter_reports")
      .insert({
        workspace_id: workspaceId,
        from_cents: reported,
        to_cents: owed,
        units: owed - reported,
        identifier: `whitby-ai:${workspaceId}:${reported}-${owed}`,
      })
      .select("id, from_cents, to_cents, units, identifier, attempts")
      .single();

    // 23505 is the partial unique index: another call opened a report while
    // this one was deciding to. That call owns it, and this one steps aside
    // rather than sending the same cents alongside it.
    if (error) {
      return error.code === "23505"
        ? { ok: true, reportedCents: 0 }
        : { ok: false, reason: error.message };
    }

    report = created as ReportRow;
  }

  try {
    await getStripe().billing.meterEvents.create({
      event_name: AI_METER_EVENT,
      // Derived from the range, so every retry of this report sends the same
      // one and Stripe counts it once.
      identifier: report.identifier,
      payload: {
        stripe_customer_id: customer,
        // Customer-facing cents after markup, which is what the handover asks
        // for; the markup is not baked into Stripe.
        value: String(report.units),
      },
    });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "Stripe refused the usage.";
    // Left pending on purpose. The next call finds this row and re-sends the
    // identical range, so nothing is lost and nothing is claimed twice.
    await supabase
      .from("whitbyos_ai_meter_reports")
      .update({ attempts: report.attempts + 1, last_error: reason })
      .eq("id", report.id);

    return { ok: false, reason };
  }

  const now = new Date().toISOString();

  await supabase
    .from("whitbyos_ai_meter_reports")
    .update({ status: "sent", sent_at: now, attempts: report.attempts + 1 })
    .eq("id", report.id);

  // Only now, and only to the end of the range Stripe actually accepted.
  await supabase.from("whitbyos_ai_meter_state").upsert(
    {
      workspace_id: workspaceId,
      reported_cents: report.to_cents,
      last_reported_at: now,
      updated_at: now,
    },
    { onConflict: "workspace_id" },
  );

  return { ok: true, reportedCents: report.units };
}

/**
 * Report without ever getting in the way, for a caller that is doing something
 * else and should not wait on Stripe or fail because of it.
 */
export function reportAiUsageInBackground(workspaceId: string): void {
  void reportAiUsageToStripe(workspaceId).catch(() => undefined);
}
