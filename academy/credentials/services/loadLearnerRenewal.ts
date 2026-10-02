import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessLearnerArea } from "@/academy/lib/authorization";
import {
  renewalStatusLabel,
  type RenewalFormStatus,
  type RenewalPaymentStatus,
  type RenewalQuestionType,
  type RenewalRequestStatus,
} from "@/academy/lib/credentialRenewal/types";
import { formatCredentialPublicId } from "@/academy/credentials/utils/publicId";
import { isCredentialRenewalOpen } from "@/academy/lib/credentialRenewal/eligibility";
import { UUID } from "@/academy/admin/types";

export type LearnerRenewalQuestion = {
  id: string;
  prompt: string;
  responseType: RenewalQuestionType;
  required: boolean;
};

export type LearnerRenewalDetail = {
  credentialId: string;
  programName: string;
  publicId: string;
  certificateNumber: string | null;
  expiresAt: string;
  expired: boolean;
  renewalRequestId: string | null;
  status: RenewalRequestStatus | null;
  statusLabel: string | null;
  formRequired: boolean;
  formStatus: RenewalFormStatus;
  paymentRequired: boolean;
  paymentStatus: RenewalPaymentStatus;
  paymentAmount: number | null;
  paymentCurrency: string;
  questions: LearnerRenewalQuestion[];
  adminNotes: string | null;
  canRequest: boolean;
  canSubmitForm: boolean;
  canPay: boolean;
  /** True on/after the expiration calendar day (or when an open request already exists). */
  renewalWindowOpen: boolean;
};

export type LoadLearnerRenewalResult =
  | { ok: true; data: LearnerRenewalDetail }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "failed" };

export async function loadLearnerRenewal(
  credentialIdRaw: string,
): Promise<LoadLearnerRenewalResult> {
  const credentialId = credentialIdRaw.trim().toLowerCase();
  if (!UUID.test(credentialId)) return { ok: false, reason: "not_found" };

  try {
    const profile = await getSessionProfile();
    if (!profile || !(await canAccessLearnerArea({ id: profile.user.id }))) {
      return { ok: false, reason: "unauthorized" };
    }

    const supabase = await createClient();
    const { data: credential, error } = await supabase
      .from("academy_credentials")
      .select(
        "id, user_id, type, status, expires_at, certificate_number, academy_programs ( name )",
      )
      .eq("id", credentialId)
      .maybeSingle();

    if (error || !credential) return { ok: false, reason: "not_found" };

    const row = credential as {
      id: string;
      user_id: string;
      type: string;
      status: string;
      expires_at: string | null;
      certificate_number: string | null;
      academy_programs: { name: string | null } | { name: string | null }[] | null;
    };

    if (row.user_id !== profile.user.id) return { ok: false, reason: "not_found" };
    if (row.status !== "awarded" || !row.expires_at) return { ok: false, reason: "invalid" };

    const program = Array.isArray(row.academy_programs)
      ? row.academy_programs[0]
      : row.academy_programs;

    const { data: request } = await supabase
      .from("academy_credential_renewal_requests")
      .select(
        "id, status, form_required, form_status, payment_required, payment_status, payment_amount, payment_currency, admin_notes",
      )
      .eq("credential_id", credentialId)
      .in("status", [
        "pending_admin",
        "awaiting_form",
        "awaiting_payment",
        "awaiting_form_and_payment",
        "under_review",
        "approved",
        "denied",
      ])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const renewal = request as {
      id: string;
      status: RenewalRequestStatus;
      form_required: boolean;
      form_status: RenewalFormStatus;
      payment_required: boolean;
      payment_status: RenewalPaymentStatus;
      payment_amount: number | string | null;
      payment_currency: string;
      admin_notes: string | null;
    } | null;

    let questions: LearnerRenewalQuestion[] = [];
    if (renewal && renewal.form_required) {
      const { data: qRows } = await supabase
        .from("academy_credential_renewal_form_questions")
        .select("id, prompt, response_type, required")
        .eq("renewal_request_id", renewal.id)
        .order("sort_order", { ascending: true });
      questions = ((qRows ?? []) as {
        id: string;
        prompt: string;
        response_type: RenewalQuestionType;
        required: boolean;
      }[]).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        responseType: q.response_type,
        required: q.required,
      }));
    }

    const windowOpen = isCredentialRenewalOpen(row.expires_at);
    const open =
      renewal &&
      ["pending_admin", "awaiting_form", "awaiting_payment", "awaiting_form_and_payment", "under_review"].includes(
        renewal.status,
      );

    const canSubmitForm = Boolean(
      renewal &&
        renewal.form_required &&
        renewal.form_status !== "submitted" &&
        ["awaiting_form", "awaiting_form_and_payment"].includes(renewal.status),
    );
    const canPay = Boolean(
      renewal &&
        renewal.payment_required &&
        renewal.payment_status !== "paid" &&
        ["awaiting_payment", "awaiting_form_and_payment"].includes(renewal.status),
    );

    return {
      ok: true,
      data: {
        credentialId: row.id,
        programName: program?.name?.trim() || "Academy program",
        publicId: row.certificate_number
          ? formatCredentialPublicId(row.type, row.certificate_number)
          : "",
        certificateNumber: row.certificate_number,
        expiresAt: row.expires_at,
        expired: Date.parse(row.expires_at) < Date.now(),
        renewalRequestId: renewal?.id ?? null,
        status: renewal?.status ?? null,
        statusLabel: renewal ? renewalStatusLabel(renewal.status) : null,
        formRequired: renewal?.form_required ?? false,
        formStatus: renewal?.form_status ?? "none",
        paymentRequired: renewal?.payment_required ?? false,
        paymentStatus: renewal?.payment_status ?? "none",
        paymentAmount:
          renewal?.payment_amount === null || renewal?.payment_amount === undefined
            ? null
            : Number(renewal.payment_amount),
        paymentCurrency: renewal?.payment_currency ?? "usd",
        questions,
        adminNotes: renewal?.admin_notes ?? null,
        canRequest: Boolean(windowOpen && !open),
        canSubmitForm,
        canPay,
        renewalWindowOpen: Boolean(windowOpen || open),
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
