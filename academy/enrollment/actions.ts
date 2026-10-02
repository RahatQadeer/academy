"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateCheckoutResult,
  FreeEnrollmentResult,
  FulfillCheckoutResult,
  StartStripeCheckoutResult,
} from "./types";

export async function enrollInFreeProgramAction(
  programId: string,
): Promise<FreeEnrollmentResult> {
  const { enrollInFreeProgram } = await import("./services/enrollInFreeProgram");
  const result = await enrollInFreeProgram(programId);

  if (result.status === "enrolled" || result.status === "already_enrolled") {
    revalidatePath("/academy");
    revalidatePath("/academy/explore");
    revalidatePath(`/academy/explore/${programId}`);
    revalidatePath("/academy/learning");
  }

  return result;
}

export async function createCheckoutSessionAction(
  programId: string,
): Promise<CreateCheckoutResult> {
  const { createCheckoutSession } = await import("./services/createCheckoutSession");
  return createCheckoutSession(programId);
}

export async function fulfillCheckoutSessionAction(
  checkoutId: string,
): Promise<FulfillCheckoutResult> {
  const { fulfillCheckoutSession } = await import("./services/fulfillCheckoutSession");
  const result = await fulfillCheckoutSession(checkoutId);

  if (result.status === "paid" || result.status === "already_paid") {
    revalidateCheckoutPaths(checkoutId, result.enrollment.program_id);
  }

  return result;
}

export async function startStripeCheckoutAction(
  checkoutId: string,
): Promise<StartStripeCheckoutResult> {
  const { startStripeCheckout } = await import("./services/stripeCheckout");
  const result = await startStripeCheckout(checkoutId);

  if (result.status === "paid") {
    revalidateCheckoutPaths(checkoutId, result.enrollment.program_id);
  }

  return result;
}

export async function syncStripeCheckoutPaymentAction(
  checkoutId: string,
): Promise<StartStripeCheckoutResult> {
  const { syncStripeCheckoutPayment } = await import("./services/stripeCheckout");
  const { getSessionProfile } = await import("@/base/identity/session");
  const profile = await getSessionProfile();
  if (!profile) {
    return { status: "unavailable", reason: "unauthenticated" };
  }

  const result = await syncStripeCheckoutPayment(checkoutId, profile.user.id);

  if (result.status === "paid") {
    revalidateCheckoutPaths(checkoutId, result.enrollment.program_id);
  }

  return result;
}

function revalidateCheckoutPaths(checkoutId: string, programId: string) {
  revalidatePath("/academy");
  revalidatePath("/academy/explore");
  revalidatePath(`/academy/explore/${programId}`);
  revalidatePath(`/academy/checkout/${checkoutId}`);
  revalidatePath("/academy/learning");
}
