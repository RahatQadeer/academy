import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import {
  canAccessInstructorArea,
  canSubmitPublishRequest,
  isInstructor,
} from "@/academy/lib/authorization";
import { getSessionProfile } from "@/base/identity/session";
import { isUnpublishedDraftPayload } from "@/academy/lib/unpublishedDraft";
import type { SubmitPublishResult } from "../types";
import { PROGRAM_ID, validateProgramName } from "../utils/validation";

export async function submitPublishRequest(programIdRaw: string): Promise<SubmitPublishResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const programId = programIdRaw.trim().toLowerCase();
    if (!PROGRAM_ID.test(programId)) return { ok: false, reason: "invalid" };

    const actor = { id: profile.user.id };
    const [area, instructor, allowed] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
      canSubmitPublishRequest(actor, programId),
    ]);
    if (!area || !instructor || !allowed) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select("id, name, status, unpublished_draft")
      .eq("id", programId)
      .maybeSingle();

    if (programError) return { ok: false, reason: "failed" };
    if (!program) return { ok: false, reason: "unauthorized" };

    const row = program as { name: string; status: string; unpublished_draft?: unknown };
    const isPublished = row.status === "published";
    const hasUnpublished = isUnpublishedDraftPayload(row.unpublished_draft);

    if (isPublished && !hasUnpublished) {
      return {
        ok: false,
        reason: "invalid",
        message: "Save unpublished edits before submitting them for approval.",
      };
    }

    if (!validateProgramName(row.name) && !(hasUnpublished && validateProgramName(String((row.unpublished_draft as { name?: string }).name ?? "")))) {
      return { ok: false, reason: "invalid", message: "Give the program a name before submitting." };
    }

    // Curriculum check: for staged republish use draft modules; otherwise live tables.
    if (isPublished && hasUnpublished) {
      const draftModules = (row.unpublished_draft as { modules?: unknown[] }).modules ?? [];
      if (draftModules.length === 0) {
        return {
          ok: false,
          reason: "invalid",
          message: "Add at least one module with a lesson before submitting for approval.",
        };
      }
      const hasLesson = draftModules.some(
        (module) =>
          module &&
          typeof module === "object" &&
          Array.isArray((module as { lessons?: unknown[] }).lessons) &&
          ((module as { lessons: unknown[] }).lessons?.length ?? 0) > 0,
      );
      if (!hasLesson) {
        return {
          ok: false,
          reason: "invalid",
          message: "Add at least one lesson before submitting for approval.",
        };
      }
    } else {
      const { count: moduleCount, error: moduleError } = await supabase
        .from("academy_modules")
        .select("id", { count: "exact", head: true })
        .eq("program_id", programId);
      if (moduleError) return { ok: false, reason: "failed" };
      if (!moduleCount) {
        return {
          ok: false,
          reason: "invalid",
          message: "Add at least one module with a lesson before submitting for approval.",
        };
      }

      const { data: moduleRows } = await supabase
        .from("academy_modules")
        .select("id")
        .eq("program_id", programId)
        .limit(100);
      const moduleIds = ((moduleRows ?? []) as { id: string }[]).map((item) => item.id);
      const { count: lessonCount, error: lessonError } =
        moduleIds.length > 0
          ? await supabase
              .from("academy_lessons")
              .select("id", { count: "exact", head: true })
              .in("module_id", moduleIds)
          : { count: 0, error: null };
      if (lessonError) return { ok: false, reason: "failed" };
      if (!lessonCount) {
        return {
          ok: false,
          reason: "invalid",
          message: "Add at least one lesson before submitting for approval.",
        };
      }
    }

    const { data: pending } = await supabase
      .from("academy_publish_requests")
      .select("id")
      .eq("program_id", programId)
      .eq("status", "pending")
      .limit(1);

    if ((pending ?? []).length > 0) {
      if (!isPublished) {
        await supabase
          .from("academy_programs")
          .update({ status: "pending_approval" })
          .eq("id", programId)
          .neq("status", "published");
      }
      return { ok: true, status: "already_pending" };
    }

    const { error: insertError } = await supabase.from("academy_publish_requests").insert({
      program_id: programId,
      submitted_by_user_id: profile.user.id,
      status: "pending",
    });
    if (insertError) return { ok: false, reason: "failed" };

    const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
    await writeProgramContentSnapshot({
      programId,
      actorUserId: profile.user.id,
      supabase,
    });

    // Republish of a live program: keep status published so learners are uninterrupted.
    if (!isPublished) {
      const { error: statusError } = await supabase
        .from("academy_programs")
        .update({ status: "pending_approval" })
        .eq("id", programId)
        .neq("status", "published");
      if (statusError) return { ok: false, reason: "failed" };
    }

    return { ok: true, status: "pending" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
