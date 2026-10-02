"use server";

import { revalidatePath } from "next/cache";
import type { AwardCredentialResult, ReturnCredentialResult } from "./types";

function revalidateCredential(credentialId: string) {
  revalidatePath("/academy/admin/credentials");
  revalidatePath(`/academy/admin/credentials/${credentialId}`);
  revalidatePath(`/academy/admin/credentials/${credentialId}/awarded`);
  revalidatePath("/academy/credentials");
  revalidatePath(`/academy/credentials/${credentialId}`);
  revalidatePath("/academy/learning");
}

export async function awardCredentialAction(
  credentialId: string,
  notes?: string,
): Promise<AwardCredentialResult> {
  const { awardCredential } = await import("./services/awardCredential");
  const result = await awardCredential(credentialId, notes);
  if (result.ok) revalidateCredential(credentialId);
  return result;
}

export async function renewCredentialAction(
  credentialId: string,
  notes?: string,
): Promise<AwardCredentialResult> {
  const { renewCredential } = await import("./services/renewCredential");
  const result = await renewCredential(credentialId, notes);
  if (result.ok) revalidateCredential(credentialId);
  return result;
}

export async function returnCredentialAction(
  credentialId: string,
  notes: string,
): Promise<ReturnCredentialResult> {
  const { returnCredential } = await import("./services/returnCredential");
  const result = await returnCredential(credentialId, notes);
  if (result.ok) revalidateCredential(credentialId);
  return result;
}

export async function approveAppliedWorkSubmissionAction(
  credentialId: string,
  submissionId: string,
): Promise<{ ok: boolean }> {
  const { approveAppliedWorkSubmission } = await import("./services/approveAppliedWorkSubmission");
  const result = await approveAppliedWorkSubmission(submissionId);
  if (result.ok) revalidateCredential(credentialId);
  return result;
}

export async function decideRenewalRequestAction(input: {
  renewalRequestId: string;
  credentialId: string;
  path: "approve_direct" | "request_info" | "require_payment" | "require_payment_and_form";
  notes?: string;
  questions?: { prompt: string; responseType: "short_answer" | "long_answer" | "attachment"; required: boolean }[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { decideRenewalRequest } = await import("./services/decideRenewalRequest");
  const result = await decideRenewalRequest(input);
  if (result.ok) {
    revalidateCredential(input.credentialId);
    revalidatePath("/academy/admin/credentials/renewals");
    revalidatePath(`/academy/admin/credentials/renewals/${input.renewalRequestId}`);
    revalidatePath(`/academy/credentials/${input.credentialId}/renew`);
    return { ok: true };
  }
  return { ok: false, message: result.message };
}

export async function denyRenewalRequestAction(input: {
  renewalRequestId: string;
  credentialId: string;
  notes?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { denyRenewalRequest } = await import("./services/decideRenewalRequest");
  const result = await denyRenewalRequest(input.renewalRequestId, input.notes);
  if (result.ok) {
    revalidateCredential(input.credentialId);
    revalidatePath("/academy/admin/credentials/renewals");
    revalidatePath(`/academy/admin/credentials/renewals/${input.renewalRequestId}`);
    revalidatePath(`/academy/credentials/${input.credentialId}/renew`);
    return { ok: true };
  }
  return { ok: false, message: result.message };
}
