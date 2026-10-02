import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessLearnerArea } from "@/academy/lib/authorization";
import { notifyAdminsOfRenewalRequest } from "@/academy/lib/credentialRenewal/notify";
import { UUID } from "@/academy/admin/types";

export type SubmitRenewalFormResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "failed"; message: string };

export type RenewalFormAnswerInput = {
  questionId: string;
  answerText?: string;
  attachmentPath?: string;
  attachmentName?: string;
};

export async function submitRenewalForm(input: {
  renewalRequestId: string;
  answers: RenewalFormAnswerInput[];
}): Promise<SubmitRenewalFormResult> {
  const renewalRequestId = input.renewalRequestId.trim().toLowerCase();
  if (!UUID.test(renewalRequestId)) {
    return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile || !(await canAccessLearnerArea({ id: profile.user.id }))) {
      return { ok: false, reason: "unauthorized", message: "Sign in to submit this form." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credential_renewal_requests")
      .select("id, credential_id, learner_user_id, status, payment_required, payment_status, form_required")
      .eq("id", renewalRequestId)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
    }

    const row = data as {
      id: string;
      credential_id: string;
      learner_user_id: string;
      status: string;
      payment_required: boolean;
      payment_status: string;
      form_required: boolean;
    };

    if (row.learner_user_id !== profile.user.id) {
      return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
    }
    if (!row.form_required || !["awaiting_form", "awaiting_form_and_payment"].includes(row.status)) {
      return {
        ok: false,
        reason: "invalid",
        message: "This renewal is not waiting for a form submission.",
      };
    }

    const { data: questions } = await supabase
      .from("academy_credential_renewal_form_questions")
      .select("id, prompt, response_type, required")
      .eq("renewal_request_id", renewalRequestId)
      .order("sort_order", { ascending: true });

    const questionRows = (questions ?? []) as {
      id: string;
      prompt: string;
      response_type: string;
      required: boolean;
    }[];

    const byId = new Map(input.answers.map((a) => [a.questionId, a]));
    for (const question of questionRows) {
      const answer = byId.get(question.id);
      if (!question.required) continue;
      if (question.response_type === "attachment") {
        if (!answer?.attachmentPath) {
          return {
            ok: false,
            reason: "invalid",
            message: `Attach a file for “${question.prompt}”.`,
          };
        }
      } else if (!answer?.answerText?.trim()) {
        return {
          ok: false,
          reason: "invalid",
          message: `Answer “${question.prompt}”.`,
        };
      }
    }

    await supabase
      .from("academy_credential_renewal_form_answers")
      .delete()
      .eq("renewal_request_id", renewalRequestId);

    const rows = questionRows.flatMap((question) => {
      const answer = byId.get(question.id);
      if (!answer) return [];
      return [
        {
          renewal_request_id: renewalRequestId,
          question_id: question.id,
          answer_text:
            question.response_type === "attachment"
              ? null
              : (answer.answerText ?? "").trim().slice(0, 8000) || null,
          attachment_path:
            question.response_type === "attachment" ? answer.attachmentPath ?? null : null,
          attachment_name:
            question.response_type === "attachment" ? answer.attachmentName ?? null : null,
        },
      ];
    });

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("academy_credential_renewal_form_answers")
        .insert(rows);
      if (insertError) {
        return { ok: false, reason: "failed", message: "Your answers could not be saved." };
      }
    }

    const paid = row.payment_required && row.payment_status === "paid";
    const needsPayment = row.payment_required && row.payment_status !== "paid";
    const now = new Date().toISOString();

    let nextStatus = "under_review";
    if (needsPayment) {
      nextStatus = "awaiting_payment";
    } else if (!row.payment_required || paid) {
      nextStatus = "under_review";
    }

    const { error: updateError } = await supabase
      .from("academy_credential_renewal_requests")
      .update({
        status: nextStatus,
        form_status: "submitted",
        form_submitted_at: now,
        updated_at: now,
      })
      .eq("id", renewalRequestId);

    if (updateError) {
      return { ok: false, reason: "failed", message: "Your answers could not be saved." };
    }

    if (nextStatus === "under_review") {
      await supabase
        .from("academy_credentials")
        .update({ renewal_status: "under_review" })
        .eq("id", row.credential_id);

      await notifyAdminsOfRenewalRequest({
        renewalRequestId,
        credentialId: row.credential_id,
        learnerName:
          profile.user.full_name?.trim() ||
          profile.user.preferred_name?.trim() ||
          "Learner",
        programName: "certificate renewal form",
      });
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "Your answers could not be saved." };
  }
}
