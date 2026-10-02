import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  renewalStatusLabel,
  type RenewalAdminPath,
  type RenewalFormStatus,
  type RenewalPaymentStatus,
  type RenewalQuestionType,
  type RenewalRequestStatus,
} from "@/academy/lib/credentialRenewal/types";
import { formatCredentialPublicId } from "@/academy/credentials/utils/publicId";
import { UUID } from "../../types";

export type AdminRenewalListItem = {
  id: string;
  credentialId: string;
  learnerName: string;
  programName: string;
  status: RenewalRequestStatus;
  statusLabel: string;
  publicId: string;
  expiresAt: string | null;
  requestedAt: string;
  paymentRequired: boolean;
  formRequired: boolean;
};

export type AdminRenewalAnswer = {
  questionId: string;
  prompt: string;
  responseType: RenewalQuestionType;
  answerText: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
};

export type AdminRenewalDetail = {
  id: string;
  credentialId: string;
  learnerName: string;
  learnerEmail: string | null;
  programName: string;
  programPrice: number | null;
  publicId: string;
  certificateNumber: string | null;
  status: RenewalRequestStatus;
  statusLabel: string;
  adminPath: RenewalAdminPath | null;
  adminNotes: string | null;
  learnerMessage: string | null;
  expiresAt: string | null;
  expiresAtAfter: string | null;
  formRequired: boolean;
  formStatus: RenewalFormStatus;
  paymentRequired: boolean;
  paymentStatus: RenewalPaymentStatus;
  paymentAmount: number | null;
  answers: AdminRenewalAnswer[];
  canDecide: boolean;
  canApproveAfterReview: boolean;
};

export async function loadAdminRenewalList(): Promise<
  | { ok: true; items: AdminRenewalListItem[] }
  | { ok: false; reason: "unauthorized" | "failed" }
> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credential_renewal_requests")
      .select(
        "id, credential_id, learner_user_id, status, form_required, payment_required, created_at, academy_credentials ( expires_at, type, certificate_number, academy_programs ( name ) )",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return { ok: false, reason: "failed" };

    const rows = (data ?? []) as {
      id: string;
      credential_id: string;
      learner_user_id: string;
      status: RenewalRequestStatus;
      form_required: boolean;
      payment_required: boolean;
      created_at: string;
      academy_credentials:
        | {
            expires_at: string | null;
            type: string;
            certificate_number: string | null;
            academy_programs: { name: string | null } | { name: string | null }[] | null;
          }
        | {
            expires_at: string | null;
            type: string;
            certificate_number: string | null;
            academy_programs: { name: string | null } | { name: string | null }[] | null;
          }[]
        | null;
    }[];

    const learnerIds = [...new Set(rows.map((r) => r.learner_user_id))];
    const nameById = new Map<string, string>();
    if (learnerIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, preferred_name, email")
        .in("id", learnerIds);
      for (const user of (users ?? []) as {
        id: string;
        full_name: string | null;
        preferred_name: string | null;
        email: string | null;
      }[]) {
        nameById.set(
          user.id,
          user.full_name?.trim() ||
            user.preferred_name?.trim() ||
            user.email?.trim() ||
            "Learner",
        );
      }
    }

    const items: AdminRenewalListItem[] = rows.map((raw) => {
      const credential = Array.isArray(raw.academy_credentials)
        ? raw.academy_credentials[0]
        : raw.academy_credentials;
      const program = Array.isArray(credential?.academy_programs)
        ? credential?.academy_programs[0]
        : credential?.academy_programs;

      return {
        id: raw.id,
        credentialId: raw.credential_id,
        learnerName: nameById.get(raw.learner_user_id) || "Learner",
        programName: program?.name?.trim() || "Program",
        status: raw.status,
        statusLabel: renewalStatusLabel(raw.status),
        publicId: credential?.certificate_number
          ? formatCredentialPublicId(credential.type, credential.certificate_number)
          : "",
        expiresAt: credential?.expires_at ?? null,
        requestedAt: raw.created_at,
        paymentRequired: raw.payment_required,
        formRequired: raw.form_required,
      };
    });

    return { ok: true, items };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function loadAdminRenewalDetail(
  renewalRequestIdRaw: string,
): Promise<
  | { ok: true; data: AdminRenewalDetail }
  | { ok: false; reason: "unauthorized" | "not_found" | "failed" }
> {
  const renewalRequestId = renewalRequestIdRaw.trim().toLowerCase();
  if (!UUID.test(renewalRequestId)) return { ok: false, reason: "not_found" };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credential_renewal_requests")
      .select(
        "id, credential_id, learner_user_id, status, admin_path, admin_notes, learner_message, form_required, form_status, payment_required, payment_status, payment_amount, expires_at_snapshot, expires_at_after, academy_credentials ( type, certificate_number, expires_at, academy_programs ( name, price ) )",
      )
      .eq("id", renewalRequestId)
      .maybeSingle();

    if (error || !data) return { ok: false, reason: "not_found" };

    const row = data as {
      id: string;
      credential_id: string;
      learner_user_id: string;
      status: RenewalRequestStatus;
      admin_path: RenewalAdminPath | null;
      admin_notes: string | null;
      learner_message: string | null;
      form_required: boolean;
      form_status: RenewalFormStatus;
      payment_required: boolean;
      payment_status: RenewalPaymentStatus;
      payment_amount: number | string | null;
      expires_at_snapshot: string | null;
      expires_at_after: string | null;
      academy_credentials:
        | {
            type: string;
            certificate_number: string | null;
            expires_at: string | null;
            academy_programs:
              | { name: string | null; price: number | string | null }
              | { name: string | null; price: number | string | null }[]
              | null;
          }
        | {
            type: string;
            certificate_number: string | null;
            expires_at: string | null;
            academy_programs:
              | { name: string | null; price: number | string | null }
              | { name: string | null; price: number | string | null }[]
              | null;
          }[]
        | null;
    };

    const credential = Array.isArray(row.academy_credentials)
      ? row.academy_credentials[0]
      : row.academy_credentials;
    const program = Array.isArray(credential?.academy_programs)
      ? credential?.academy_programs[0]
      : credential?.academy_programs;

    const { data: learner } = await supabase
      .from("users")
      .select("full_name, preferred_name, email")
      .eq("id", row.learner_user_id)
      .maybeSingle();
    const learnerRow = learner as {
      full_name: string | null;
      preferred_name: string | null;
      email: string | null;
    } | null;

    const { data: questions } = await supabase
      .from("academy_credential_renewal_form_questions")
      .select("id, prompt, response_type")
      .eq("renewal_request_id", renewalRequestId)
      .order("sort_order", { ascending: true });

    const { data: answers } = await supabase
      .from("academy_credential_renewal_form_answers")
      .select("question_id, answer_text, attachment_path, attachment_name")
      .eq("renewal_request_id", renewalRequestId);

    const answerByQ = new Map(
      ((answers ?? []) as {
        question_id: string;
        answer_text: string | null;
        attachment_path: string | null;
        attachment_name: string | null;
      }[]).map((a) => [a.question_id, a]),
    );

    const answerRows: AdminRenewalAnswer[] = (
      (questions ?? []) as { id: string; prompt: string; response_type: RenewalQuestionType }[]
    ).map((q) => {
      const a = answerByQ.get(q.id);
      return {
        questionId: q.id,
        prompt: q.prompt,
        responseType: q.response_type,
        answerText: a?.answer_text ?? null,
        attachmentPath: a?.attachment_path ?? null,
        attachmentName: a?.attachment_name ?? null,
      };
    });

    const price =
      program?.price === null || program?.price === undefined || program?.price === ""
        ? null
        : Number(program.price);

    return {
      ok: true,
      data: {
        id: row.id,
        credentialId: row.credential_id,
        learnerName:
          learnerRow?.full_name?.trim() ||
          learnerRow?.preferred_name?.trim() ||
          learnerRow?.email?.trim() ||
          "Learner",
        learnerEmail: learnerRow?.email ?? null,
        programName: program?.name?.trim() || "Program",
        programPrice: price !== null && Number.isFinite(price) ? price : null,
        publicId: credential?.certificate_number
          ? formatCredentialPublicId(credential.type, credential.certificate_number)
          : "",
        certificateNumber: credential?.certificate_number ?? null,
        status: row.status,
        statusLabel: renewalStatusLabel(row.status),
        adminPath: row.admin_path,
        adminNotes: row.admin_notes,
        learnerMessage: row.learner_message,
        expiresAt: credential?.expires_at ?? row.expires_at_snapshot,
        expiresAtAfter: row.expires_at_after,
        formRequired: row.form_required,
        formStatus: row.form_status,
        paymentRequired: row.payment_required,
        paymentStatus: row.payment_status,
        paymentAmount:
          row.payment_amount === null || row.payment_amount === undefined
            ? null
            : Number(row.payment_amount),
        answers: answerRows,
        canDecide: row.status === "pending_admin",
        canApproveAfterReview: row.status === "under_review",
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
