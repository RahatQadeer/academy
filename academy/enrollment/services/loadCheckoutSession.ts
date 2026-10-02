import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAcademy,
  canAccessLearnerArea,
} from "@/academy/lib/authorization";
import { isStripeCheckoutConfigured } from "../utils/payment";
import type { CheckoutSessionSummary, LoadCheckoutResult } from "../types";

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
  academy_programs: { name: string; description: string | null; status: string } | null;
};

export async function loadCheckoutSession(
  userId: string,
  checkoutId: string,
): Promise<LoadCheckoutResult> {
  if (!userId || !CHECKOUT_ID.test(checkoutId)) {
    return { ok: false, reason: "not_found" };
  }

  const profile = await getSessionProfile();
  if (!profile || profile.user.id !== userId) {
    return { ok: false, reason: "unauthorized" };
  }

  const actor = { id: profile.user.id };
  if (!(await canAccessAcademy(actor)) || !(await canAccessLearnerArea(actor))) {
    return { ok: false, reason: "unauthorized" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_checkout_sessions")
      .select(
        "id, user_id, program_id, amount, currency, status, stripe_checkout_session_id, academy_programs ( name, description, status )",
      )
      .eq("id", checkoutId)
      .maybeSingle();

    if (error) return { ok: false, reason: "failed" };
    if (!data) return { ok: false, reason: "not_found" };

    const row = data as unknown as CheckoutRow;
    if (row.user_id !== userId) {
      return { ok: false, reason: "not_found" };
    }

    const program = Array.isArray(row.academy_programs)
      ? row.academy_programs[0]
      : row.academy_programs;

    if (!program || program.status !== "published") {
      return { ok: false, reason: "not_found" };
    }

    const checkout: CheckoutSessionSummary = {
      id: row.id,
      programId: row.program_id,
      programName: program.name,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status as CheckoutSessionSummary["status"],
      stripeCheckoutSessionId: row.stripe_checkout_session_id,
    };

    return {
      ok: true,
      data: {
        checkout,
        programDescription: program.description,
        stripeEnabled: isStripeCheckoutConfigured(),
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
