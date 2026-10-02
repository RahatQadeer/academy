import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAcademy,
  canAccessAdminArea,
  canAuthorProgram,
  canPublishProgram,
  isInstructor,
} from "@/academy/lib/authorization";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { ProgramPublicationFailure, ProgramPublicationResult } from "../types";

type RpcEnvelope = {
  status?: string;
  program_id?: string;
  published_at?: string | null;
  published_by_user_id?: string | null;
};

function failure(
  reason: ProgramPublicationFailure,
  message?: string,
): ProgramPublicationResult {
  return { ok: false, reason, message };
}

function asFailure(status: string | undefined): ProgramPublicationFailure {
  if (
    status === "unauthenticated" ||
    status === "unauthorized" ||
    status === "not_found" ||
    status === "not_approved" ||
    status === "invalid_state"
  ) {
    return status;
  }
  return "failed";
}

function messageFor(reason: ProgramPublicationFailure) {
  if (reason === "unauthenticated") return "Sign in to publish this program.";
  if (reason === "unauthorized") return "You are not allowed to publish this program.";
  if (reason === "not_found") return "This program could not be found.";
  if (reason === "not_approved") return "An Academy Admin must approve this program before it can be published.";
  if (reason === "invalid_state") return "This program cannot be published in its current state.";
  return "The program could not be published.";
}

export async function publishProgram(programIdRaw: string): Promise<ProgramPublicationResult> {
  const programId = programIdRaw.trim().toLowerCase();
  if (!PROGRAM_ID.test(programId)) {
    return failure("not_found", messageFor("not_found"));
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return failure("unauthenticated", messageFor("unauthenticated"));
    const actor = { id: profile.user.id };
    if (!(await canAccessAcademy(actor))) {
      return failure("unauthorized", messageFor("unauthorized"));
    }
    const [admin, instructor] = await Promise.all([
      canAccessAdminArea(actor),
      isInstructor(actor),
    ]);
    if (!admin && !instructor) {
      return failure("unauthorized", messageFor("unauthorized"));
    }
    if (!admin && !(await canAuthorProgram(actor, programId))) {
      return failure("unauthorized", messageFor("unauthorized"));
    }
    if (!(await canPublishProgram(actor, programId))) {
      return failure("not_approved", messageFor("not_approved"));
    }

    const supabase = await createClient();

    const { data: programRow } = await supabase
      .from("academy_programs")
      .select("status, unpublished_draft")
      .eq("id", programId)
      .maybeSingle();
    const status = (programRow as { status?: string } | null)?.status;
    const draft = (programRow as { unpublished_draft?: unknown } | null)?.unpublished_draft;
    const { isUnpublishedDraftPayload } = await import("@/academy/lib/unpublishedDraft");

    if (status === "published" && isUnpublishedDraftPayload(draft)) {
      const { applyUnpublishedDraft } = await import(
        "@/academy/admin/services/applyUnpublishedDraft"
      );
      const applied = await applyUnpublishedDraft(programId);
      if (!applied.ok) {
        return failure(
          applied.reason === "unauthorized" ? "not_approved" : "failed",
          applied.message ?? messageFor("failed"),
        );
      }
      return {
        ok: true,
        status: "published",
        programId,
        publishedAt: new Date().toISOString(),
        publishedByUserId: profile.user.id,
      };
    }

    const { data, error } = await supabase.rpc("academy_publish_program", {
      p_program_id: programId,
    });
    if (error) return failure("failed", messageFor("failed"));

    const envelope = (typeof data === "string" ? JSON.parse(data) : data) as RpcEnvelope | null;
    if (!envelope || typeof envelope !== "object") {
      return failure("failed", messageFor("failed"));
    }

    if (envelope.status === "published" || envelope.status === "already_published") {
      return {
        ok: true,
        status: envelope.status,
        programId,
        publishedAt: envelope.published_at ?? null,
        publishedByUserId: envelope.published_by_user_id ?? null,
      };
    }

    const reason = asFailure(envelope.status);
    return failure(reason, messageFor(reason));
  } catch {
    return failure("failed", messageFor("failed"));
  }
}
