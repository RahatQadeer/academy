import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAcademy,
  canAccessLearnerArea,
} from "@/academy/lib/authorization";
import type { CheckoutUnavailableReason, FulfillCheckoutResult } from "../types";
import { fulfillCheckoutById } from "./fulfillCheckoutById";

const CHECKOUT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fulfillCheckoutSession(checkoutId: string): Promise<FulfillCheckoutResult> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable", reason: "failed" };
  }
  if (typeof checkoutId !== "string" || !CHECKOUT_ID.test(checkoutId)) {
    return { status: "unavailable", reason: "not_found" };
  }

  const profile = await getSessionProfile();
  if (!profile) {
    return { status: "unavailable", reason: "unauthenticated" };
  }

  const user = { id: profile.user.id };
  if (!(await canAccessAcademy(user))) {
    return { status: "unavailable", reason: "no_academy_access" };
  }
  if (!(await canAccessLearnerArea(user))) {
    return { status: "unavailable", reason: "no_learner_capability" };
  }

  try {
    const supabase = await createClient();
    const { data: checkout, error: checkoutError } = await supabase
      .from("academy_checkout_sessions")
      .select("id, user_id")
      .eq("id", checkoutId)
      .maybeSingle();

    if (checkoutError) return { status: "unavailable", reason: "failed" };
    if (!checkout) return { status: "unavailable", reason: "not_found" };

    if ((checkout as { user_id: string }).user_id !== user.id) {
      return { status: "unavailable", reason: "not_found" };
    }

    const result = await fulfillCheckoutById(checkoutId);
    if (!result.ok) {
      return { status: "unavailable", reason: result.reason };
    }

    return result.alreadyPaid
      ? { status: "already_paid", checkoutId, enrollment: result.enrollment }
      : { status: "paid", checkoutId, enrollment: result.enrollment };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}
