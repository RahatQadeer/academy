import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canApprovePublishRequest,
  isAcademyAdmin,
} from "@/academy/lib/authorization";
import type { ReviewPublishRequestInput, ReviewPublishRequestResult } from "../../types";
import { NOTES_MAX, UUID } from "../../types";

type RequestRow = {
  id: string;
  program_id: string;
  submitted_by_user_id: string;
  status: string;
};

type ProgramRow = { id: string; status: string };

function trimNotes(raw: string | undefined) {
  return (raw ?? "").trim().slice(0, NOTES_MAX);
}

export async function reviewPublishRequest(
  input: ReviewPublishRequestInput,
): Promise<ReviewPublishRequestResult> {
  const requestId = input.requestId.trim().toLowerCase();
  if (!UUID.test(requestId)) return { ok: false, reason: "invalid", message: "Invalid request." };
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { ok: false, reason: "invalid", message: "Choose approve or reject." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin, allowed] = await Promise.all([
      canAccessAdminArea(actor),
      isAcademyAdmin(actor),
      canApprovePublishRequest(actor, requestId),
    ]);
    if (!area || !admin || !allowed) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: request, error: requestError } = await supabase
      .from("academy_publish_requests")
      .select("id, program_id, submitted_by_user_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) return { ok: false, reason: "failed" };
    const requestRow = request as RequestRow | null;
    if (!requestRow) return { ok: false, reason: "not_found" };
    if (requestRow.status !== "pending") {
      return {
        ok: false,
        reason: "already_reviewed",
        message: "This request has already been reviewed.",
      };
    }

    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select("id, status")
      .eq("id", requestRow.program_id)
      .maybeSingle();

    if (programError) return { ok: false, reason: "failed" };
    const programRow = program as ProgramRow | null;
    if (!programRow) return { ok: false, reason: "not_found" };
    if (programRow.status === "published") {
      // Republish of unpublished edits: approve/reject the request only; keep live.
      const notes = trimNotes(input.notes) || null;
      const reviewedAt = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from("academy_publish_requests")
        .update({
          status: input.decision,
          reviewed_by_admin_user_id: actor.id,
          reviewed_at: reviewedAt,
          notes,
        })
        .eq("id", requestId)
        .eq("status", "pending")
        .select("id, status")
        .maybeSingle();

      if (updateError) return { ok: false, reason: "failed" };
      if (!updated) {
        return {
          ok: false,
          reason: "already_reviewed",
          message: "This request has already been reviewed.",
        };
      }

      const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
      await writeProgramContentSnapshot({
        programId: programRow.id,
        actorUserId: actor.id,
        supabase,
      });

      return { ok: true, status: input.decision, programId: programRow.id };
    }

    const notes = trimNotes(input.notes) || null;
    const reviewedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("academy_publish_requests")
      .update({
        status: input.decision,
        reviewed_by_admin_user_id: actor.id,
        reviewed_at: reviewedAt,
        notes,
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();

    if (updateError) return { ok: false, reason: "failed" };
    if (!updated) {
      return {
        ok: false,
        reason: "already_reviewed",
        message: "This request has already been reviewed.",
      };
    }

    if (input.decision === "rejected" && programRow.status === "pending_approval") {
      const { error: revertError } = await supabase
        .from("academy_programs")
        .update({ status: "draft" })
        .eq("id", programRow.id)
        .eq("status", "pending_approval");
      if (revertError) return { ok: false, reason: "failed" };
    }

    const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
    await writeProgramContentSnapshot({
      programId: programRow.id,
      actorUserId: actor.id,
      supabase,
    });

    return { ok: true, status: input.decision, programId: programRow.id };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
