"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";

export type SubmitAppliedWorkResult =
  | { ok: true }
  | { ok: false; message: string };

export type RequestCertificateActionResult =
  | { ok: true; alreadyRequested: boolean; requestedAt: string | null }
  | { ok: false; message: string };

export async function requestCertificateAction(
  credentialId: string,
): Promise<RequestCertificateActionResult> {
  const { requestCertificate } = await import("./services/requestCertificate");
  const result = await requestCertificate(credentialId);
  if (result.ok) {
    revalidatePath("/academy/credentials");
    revalidatePath(`/academy/credentials/${credentialId}`);
    revalidatePath("/academy/admin/credentials");
  }
  return result;
}

export async function submitAppliedWorkAction(
  formData: FormData,
): Promise<SubmitAppliedWorkResult> {
  const profile = await getSessionProfile();
  if (!profile) {
    return { ok: false, message: "Sign in to submit applied work." };
  }

  const credentialId = String(formData.get("credentialId") ?? "").trim();
  const lessonId = String(formData.get("lessonId") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const document = formData.get("document");

  if (!credentialId || !lessonId || !summary) {
    return { ok: false, message: "Summary is required." };
  }

  const supabase = await createClient();
  let documentPath: string | null = null;

  if (document instanceof File && document.size > 0) {
    const safeName = document.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `applied-work/${profile.user.id}/${credentialId}/${lessonId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("academy")
      .upload(path, document, { upsert: false });
    if (uploadError) {
      return { ok: false, message: "Could not upload the supporting document. Try again." };
    }
    documentPath = path;
  }

  const { data, error } = await supabase.rpc("academy_submit_applied_work", {
    p_credential_id: credentialId,
    p_lesson_id: lessonId,
    p_summary: summary,
    p_document_storage_path: documentPath,
  });

  if (error) {
    return { ok: false, message: "Submission could not be saved. Try again." };
  }

  const payload = data as { status?: string; reason?: string } | null;
  if (payload?.status !== "ok") {
    if (payload?.reason === "summary_required") {
      return { ok: false, message: "Summary is required." };
    }
    if (payload?.reason === "not_accepting_submissions") {
      return { ok: false, message: "This credential is not accepting submissions right now." };
    }
    return { ok: false, message: "Submission could not be saved. Try again." };
  }

  revalidatePath("/academy/credentials");
  revalidatePath(`/academy/credentials/${credentialId}`);
  return { ok: true };
}

export async function requestCredentialRenewalAction(
  credentialId: string,
  message?: string,
): Promise<{ ok: true; renewalRequestId: string } | { ok: false; message: string }> {
  const { requestCredentialRenewal } = await import("./services/requestCredentialRenewal");
  const result = await requestCredentialRenewal(credentialId, message);
  if (result.ok) {
    revalidatePath("/academy/credentials");
    revalidatePath(`/academy/credentials/${credentialId}`);
    revalidatePath(`/academy/credentials/${credentialId}/renew`);
    revalidatePath("/academy/admin/credentials");
    revalidatePath("/academy/admin/credentials/renewals");
    return result;
  }
  return { ok: false, message: result.message };
}

export async function submitRenewalFormAction(input: {
  renewalRequestId: string;
  credentialId: string;
  answers: {
    questionId: string;
    answerText?: string;
    attachmentPath?: string;
    attachmentName?: string;
  }[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { submitRenewalForm } = await import("./services/submitRenewalForm");
  const result = await submitRenewalForm(input);
  if (result.ok) {
    revalidatePath(`/academy/credentials/${input.credentialId}/renew`);
    revalidatePath("/academy/admin/credentials/renewals");
    revalidatePath(`/academy/admin/credentials/renewals/${input.renewalRequestId}`);
    return { ok: true };
  }
  return { ok: false, message: result.message };
}

export async function startRenewalPaymentAction(
  renewalRequestId: string,
  credentialId: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const { startRenewalPayment } = await import("./services/startRenewalPayment");
  const result = await startRenewalPayment(renewalRequestId);
  if (result.ok) {
    revalidatePath(`/academy/credentials/${credentialId}/renew`);
    return result;
  }
  return { ok: false, message: result.message };
}

export async function uploadRenewalAttachmentAction(
  formData: FormData,
): Promise<{ ok: true; path: string; fileName: string } | { ok: false; message: string }> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, message: "Sign in to upload a file." };

  const renewalRequestId = String(formData.get("renewalRequestId") ?? "").trim();
  const questionId = String(formData.get("questionId") ?? "").trim();
  const document = formData.get("document");
  if (!(document instanceof File) || document.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  if (document.size > 12 * 1024 * 1024) {
    return { ok: false, message: "Files must be 12 MB or smaller." };
  }

  const safeName = document.name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
  const path = `renewal-forms/${renewalRequestId}/${questionId}/${Date.now()}-${safeName}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from("academy").upload(path, document, { upsert: false });
  if (error) return { ok: false, message: "Could not upload the file. Try again." };
  return { ok: true, path, fileName: safeName };
}
