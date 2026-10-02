import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { applyCredentialRenewalTerm } from "@/academy/lib/credentialRenewal/applyRenewalTerm";
import { isCredentialRenewalOpen } from "@/academy/lib/credentialRenewal/eligibility";
import { notifyLearnerRenewalUpdate } from "@/academy/lib/credentialRenewal/notify";
import type {
  RenewalAdminPath,
  RenewalFormQuestionDraft,
} from "@/academy/lib/credentialRenewal/types";
import { writeCredentialReviewLog } from "@/academy/lib/credentialReviewLog";
import { UUID } from "../../types";

export type DecideRenewalResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "not_found" | "invalid" | "failed"; message: string };

type DecideInput = {
  renewalRequestId: string;
  path: RenewalAdminPath;
  notes?: string;
  questions?: RenewalFormQuestionDraft[];
};

async function authorizeAdmin() {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const actor = { id: profile.user.id };
  const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
  if (!area || !admin) return null;
  return profile;
}

export async function decideRenewalRequest(input: DecideInput): Promise<DecideRenewalResult> {
  const renewalRequestId = input.renewalRequestId.trim().toLowerCase();
  if (!UUID.test(renewalRequestId)) {
    return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
  }

  try {
    const profile = await authorizeAdmin();
    if (!profile) {
      return { ok: false, reason: "unauthorized", message: "This area is limited to Academy Admins." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_credential_renewal_requests")
      .select(
        "id, credential_id, learner_user_id, status, academy_credentials ( id, expires_at, status, academy_programs ( name, price ) )",
      )
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
      academy_credentials:
        | {
            id: string;
            expires_at: string | null;
            status: string;
            academy_programs: { name: string | null; price: number | string | null } | { name: string | null; price: number | string | null }[] | null;
          }
        | {
            id: string;
            expires_at: string | null;
            status: string;
            academy_programs: { name: string | null; price: number | string | null } | { name: string | null; price: number | string | null }[] | null;
          }[]
        | null;
    };

    if (row.status !== "pending_admin" && row.status !== "under_review") {
      return {
        ok: false,
        reason: "invalid",
        message: "This renewal request is not waiting for an admin decision.",
      };
    }

    const credential = Array.isArray(row.academy_credentials)
      ? row.academy_credentials[0]
      : row.academy_credentials;
    if (!credential || credential.status !== "awarded" || !credential.expires_at) {
      return {
        ok: false,
        reason: "invalid",
        message: "Only awarded timed certificates can be renewed.",
      };
    }

    // Block early year-stacking: term must have reached its expiration day.
    if (!isCredentialRenewalOpen(credential.expires_at)) {
      return {
        ok: false,
        reason: "invalid",
        message:
          "Renewal is only available on or after the certificate expiration date. Early renewal is not allowed.",
      };
    }

    const program = Array.isArray(credential.academy_programs)
      ? credential.academy_programs[0]
      : credential.academy_programs;
    const programName = program?.name?.trim() || "Academy program";
    const priceRaw = program?.price;
    const price =
      priceRaw === null || priceRaw === undefined || priceRaw === ""
        ? null
        : Number(priceRaw);

    const notes = input.notes?.trim().slice(0, 4000) || null;
    const now = new Date().toISOString();

    if (input.path === "approve_direct") {
      const applied = await applyCredentialRenewalTerm({
        supabase: supabase as never,
        credentialId: row.credential_id,
        currentExpiresAt: credential.expires_at,
      });
      if (!applied.ok) return { ok: false, reason: "failed", message: applied.message };

      const { error: updateError } = await supabase
        .from("academy_credential_renewal_requests")
        .update({
          status: "approved",
          admin_path: "approve_direct",
          admin_notes: notes,
          decided_by_user_id: profile.user.id,
          decided_at: now,
          expires_at_after: applied.expiresAt,
          form_status: row.status === "under_review" ? "reviewed" : "none",
          updated_at: now,
        })
        .eq("id", renewalRequestId);
      if (updateError) {
        return { ok: false, reason: "failed", message: "The renewal could not be approved." };
      }

      await writeCredentialReviewLog({
        credentialId: row.credential_id,
        actorUserId: profile.user.id,
        action: "renew",
        notes: notes || "Renewal approved.",
        previousStatus: "awarded",
        nextStatus: "awarded",
      });

      const { data: learner } = await supabase
        .from("users")
        .select("email, full_name, preferred_name")
        .eq("id", row.learner_user_id)
        .maybeSingle();
      const learnerRow = learner as {
        email: string | null;
        full_name: string | null;
        preferred_name: string | null;
      } | null;

      await notifyLearnerRenewalUpdate({
        to: learnerRow?.email,
        learnerName:
          learnerRow?.full_name?.trim() ||
          learnerRow?.preferred_name?.trim() ||
          "Learner",
        programName,
        subject: `Certificate renewed — ${programName}`,
        detail: `Your certificate for ${programName} has been renewed for a new three-year term.`,
        href: `/academy/credentials/${row.credential_id}`,
      });

      return { ok: true };
    }

    if (input.path === "request_info") {
      const questions = (input.questions ?? [])
        .map((q) => ({
          prompt: q.prompt.trim().slice(0, 500),
          responseType: q.responseType,
          required: q.required !== false,
        }))
        .filter((q) => q.prompt.length > 0);

      if (questions.length === 0) {
        return {
          ok: false,
          reason: "invalid",
          message: "Add at least one question before requesting information.",
        };
      }

      await supabase
        .from("academy_credential_renewal_form_questions")
        .delete()
        .eq("renewal_request_id", renewalRequestId);

      const { error: qError } = await supabase.from("academy_credential_renewal_form_questions").insert(
        questions.map((q, index) => ({
          renewal_request_id: renewalRequestId,
          sort_order: index,
          prompt: q.prompt,
          response_type: q.responseType,
          required: q.required,
        })),
      );
      if (qError) {
        return { ok: false, reason: "failed", message: "The information form could not be saved." };
      }

      const { error: updateError } = await supabase
        .from("academy_credential_renewal_requests")
        .update({
          status: "awaiting_form",
          admin_path: "request_info",
          admin_notes: notes,
          decided_by_user_id: profile.user.id,
          decided_at: now,
          form_required: true,
          form_status: "pending",
          payment_required: false,
          payment_status: "none",
          updated_at: now,
        })
        .eq("id", renewalRequestId);
      if (updateError) {
        return { ok: false, reason: "failed", message: "The request could not be updated." };
      }

      await supabase
        .from("academy_credentials")
        .update({ renewal_status: "awaiting_learner" })
        .eq("id", row.credential_id);

      const { data: learner } = await supabase
        .from("users")
        .select("email, full_name, preferred_name")
        .eq("id", row.learner_user_id)
        .maybeSingle();
      const learnerRow = learner as {
        email: string | null;
        full_name: string | null;
        preferred_name: string | null;
      } | null;

      await notifyLearnerRenewalUpdate({
        to: learnerRow?.email,
        learnerName:
          learnerRow?.full_name?.trim() ||
          learnerRow?.preferred_name?.trim() ||
          "Learner",
        programName,
        subject: `Additional information needed — ${programName}`,
        detail: `An Academy Admin requested additional information before renewing your certificate for ${programName}.`,
        href: `/academy/credentials/${row.credential_id}/renew`,
      });

      return { ok: true };
    }

    // Payment paths
    if (price === null || !Number.isFinite(price) || price <= 0) {
      return {
        ok: false,
        reason: "invalid",
        message:
          "This program has no renewal fee configured. Choose Approve directly or Request information instead.",
      };
    }

    const withForm = input.path === "require_payment_and_form";
    if (withForm) {
      const questions = (input.questions ?? [])
        .map((q) => ({
          prompt: q.prompt.trim().slice(0, 500),
          responseType: q.responseType,
          required: q.required !== false,
        }))
        .filter((q) => q.prompt.length > 0);
      if (questions.length === 0) {
        return {
          ok: false,
          reason: "invalid",
          message: "Add at least one question, or choose Payment only.",
        };
      }
      await supabase
        .from("academy_credential_renewal_form_questions")
        .delete()
        .eq("renewal_request_id", renewalRequestId);
      const { error: qError } = await supabase.from("academy_credential_renewal_form_questions").insert(
        questions.map((q, index) => ({
          renewal_request_id: renewalRequestId,
          sort_order: index,
          prompt: q.prompt,
          response_type: q.responseType,
          required: q.required,
        })),
      );
      if (qError) {
        return { ok: false, reason: "failed", message: "The information form could not be saved." };
      }
    }

    const { error: updateError } = await supabase
      .from("academy_credential_renewal_requests")
      .update({
        status: withForm ? "awaiting_form_and_payment" : "awaiting_payment",
        admin_path: withForm ? "require_payment_and_form" : "require_payment",
        admin_notes: notes,
        decided_by_user_id: profile.user.id,
        decided_at: now,
        form_required: withForm,
        form_status: withForm ? "pending" : "none",
        payment_required: true,
        payment_amount: price,
        payment_currency: "usd",
        payment_status: "pending",
        updated_at: now,
      })
      .eq("id", renewalRequestId);
    if (updateError) {
      return { ok: false, reason: "failed", message: "The request could not be updated." };
    }

    await supabase
      .from("academy_credentials")
      .update({ renewal_status: "awaiting_learner" })
      .eq("id", row.credential_id);

    const { data: learner } = await supabase
      .from("users")
      .select("email, full_name, preferred_name")
      .eq("id", row.learner_user_id)
      .maybeSingle();
    const learnerRow = learner as {
      email: string | null;
      full_name: string | null;
      preferred_name: string | null;
    } | null;

    await notifyLearnerRenewalUpdate({
      to: learnerRow?.email,
      learnerName:
        learnerRow?.full_name?.trim() ||
        learnerRow?.preferred_name?.trim() ||
        "Learner",
      programName,
      subject: `Certificate renewal — next steps for ${programName}`,
      detail: withForm
        ? `To renew your certificate for ${programName}, complete the requested information and pay the renewal fee ($${price.toFixed(2)}).`
        : `To renew your certificate for ${programName}, pay the renewal fee ($${price.toFixed(2)}). Payment completes renewal automatically.`,
      href: `/academy/credentials/${row.credential_id}/renew`,
    });

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The renewal decision could not be saved." };
  }
}

export async function denyRenewalRequest(
  renewalRequestIdRaw: string,
  notesRaw?: string,
): Promise<DecideRenewalResult> {
  const renewalRequestId = renewalRequestIdRaw.trim().toLowerCase();
  if (!UUID.test(renewalRequestId)) {
    return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
  }

  try {
    const profile = await authorizeAdmin();
    if (!profile) {
      return { ok: false, reason: "unauthorized", message: "This area is limited to Academy Admins." };
    }

    const supabase = await createClient();
    const { data } = await supabase
      .from("academy_credential_renewal_requests")
      .select("id, credential_id, learner_user_id, status")
      .eq("id", renewalRequestId)
      .maybeSingle();
    const row = data as {
      id: string;
      credential_id: string;
      learner_user_id: string;
      status: string;
    } | null;
    if (!row) {
      return { ok: false, reason: "not_found", message: "This renewal request could not be found." };
    }
    if (!["pending_admin", "under_review", "awaiting_form", "awaiting_payment", "awaiting_form_and_payment"].includes(row.status)) {
      return { ok: false, reason: "invalid", message: "This renewal request can no longer be denied." };
    }

    const now = new Date().toISOString();
    const notes = notesRaw?.trim().slice(0, 4000) || null;
    await supabase
      .from("academy_credential_renewal_requests")
      .update({
        status: "denied",
        admin_notes: notes,
        decided_by_user_id: profile.user.id,
        decided_at: now,
        updated_at: now,
      })
      .eq("id", renewalRequestId);

    await supabase
      .from("academy_credentials")
      .update({ renewal_status: "active" })
      .eq("id", row.credential_id);

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The renewal could not be denied." };
  }
}
