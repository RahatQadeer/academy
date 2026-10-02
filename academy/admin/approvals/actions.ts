"use server";

import { revalidatePath } from "next/cache";
import type { ReviewPublishRequestInput, ReviewPublishRequestResult } from "../types";

export async function reviewPublishRequestAction(
  input: ReviewPublishRequestInput,
): Promise<ReviewPublishRequestResult> {
  const { reviewPublishRequest } = await import("./services/reviewPublishRequest");
  const result = await reviewPublishRequest(input);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/approvals");
    revalidatePath(`/academy/admin/approvals/${input.requestId}`);
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    revalidatePath(`/academy/instructor/programs/${result.programId}`);
  }
  return result;
}

export async function publishApprovedProgramAction(requestId: string) {
  const { publishApprovedProgram } = await import("./services/publishApprovedProgram");
  const result = await publishApprovedProgram(requestId);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/approvals");
    revalidatePath(`/academy/admin/approvals/${requestId}`);
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    if (result.programId) {
      revalidatePath(`/academy/instructor/programs/${result.programId}`);
    }
    revalidatePath("/academy/explore");
  }
  return result;
}

export async function approveAndPublishRequestAction(requestId: string) {
  const { reviewPublishRequest } = await import("./services/reviewPublishRequest");
  const { publishApprovedProgram } = await import("./services/publishApprovedProgram");

  const review = await reviewPublishRequest({
    requestId,
    decision: "approved",
  });
  if (!review.ok) {
    return {
      ok: false as const,
      message: review.message || "This request could not be approved.",
    };
  }

  const publish = await publishApprovedProgram(requestId);
  if (!publish.ok) {
    return {
      ok: false as const,
      message: publish.message || "Approved, but publishing failed. Try again from the queue.",
    };
  }

  revalidatePath("/academy/admin");
  revalidatePath("/academy/admin/approvals");
  revalidatePath(`/academy/admin/approvals/${requestId}`);
  revalidatePath("/academy/instructor");
  revalidatePath("/academy/instructor/programs");
  if (publish.programId) {
    revalidatePath(`/academy/instructor/programs/${publish.programId}`);
  }
  revalidatePath("/academy/explore");

  return { ok: true as const, programId: publish.programId };
}
