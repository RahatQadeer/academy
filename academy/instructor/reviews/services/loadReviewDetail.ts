import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessInstructorArea,
  canAuthorProgram,
  isInstructor,
} from "@/academy/lib/authorization";
import { isAcademyAssignmentSubmissionStatus } from "@/academy/lib/domain";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { InstructorReviewDetailResult } from "../types";

type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

function displayName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `Learner ${userId.slice(0, 8)}`;
}

function asScore(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function loadInstructorReviewDetail(
  submissionId: string,
): Promise<InstructorReviewDetailResult> {
  if (!PROGRAM_ID.test(submissionId)) return { ok: false, reason: "not_found" };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, instructor] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
    ]);
    if (!area || !instructor) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_assignment_submissions")
      .select(
        "id, assignment_id, lesson_id, program_id, user_id, status, body, file_storage_path, file_name, score, max_score, feedback, attempt_count, submitted_at, graded_at",
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (error) return { ok: false, reason: "failed" };
    const row = data as {
      id: string;
      assignment_id: string;
      lesson_id: string;
      program_id: string;
      user_id: string;
      status: string;
      body: string;
      file_storage_path: string | null;
      file_name: string | null;
      score: number | string | null;
      max_score: number | string | null;
      feedback: string;
      attempt_count: number;
      submitted_at: string | null;
      graded_at: string | null;
    } | null;

    if (!row || !isAcademyAssignmentSubmissionStatus(row.status)) {
      return { ok: false, reason: "not_found" };
    }
    if (!(await canAuthorProgram(actor, row.program_id))) {
      return { ok: false, reason: "unauthorized" };
    }

    const [{ data: program }, { data: lesson }, { data: assignment }, { data: identities }] =
      await Promise.all([
        supabase.from("academy_programs").select("id, name").eq("id", row.program_id).maybeSingle(),
        supabase.from("academy_lessons").select("id, title").eq("id", row.lesson_id).maybeSingle(),
        supabase
          .from("academy_assignments")
          .select("brief, submission_instructions, rubric")
          .eq("id", row.assignment_id)
          .maybeSingle(),
        supabase.rpc("academy_author_learner_identities", { p_user_ids: [row.user_id] }),
      ]);

    let fileUrl: string | null = null;
    if (row.file_storage_path) {
      const signed = await supabase.storage.from("academy").createSignedUrl(row.file_storage_path, 60 * 60);
      fileUrl = signed.data?.signedUrl ?? null;
    }

    const identity = ((identities ?? []) as IdentityRow[]).find(
      (item) => item.id.toLowerCase() === row.user_id.toLowerCase(),
    );
    const assignmentRow = assignment as {
      brief: string;
      submission_instructions: string;
      rubric: string;
    } | null;

    return {
      ok: true,
      data: {
        id: row.id,
        assignmentId: row.assignment_id,
        lessonId: row.lesson_id,
        programId: row.program_id,
        userId: row.user_id,
        status: row.status,
        body: row.body ?? "",
        fileName: row.file_name,
        fileUrl,
        score: asScore(row.score),
        maxScore: asScore(row.max_score) ?? 100,
        feedback: row.feedback ?? "",
        attemptCount: row.attempt_count ?? 0,
        submittedAt: row.submitted_at,
        gradedAt: row.graded_at,
        learnerName: displayName(identity, row.user_id),
        learnerEmail: identity?.email ?? null,
        programName: (program as { name?: string } | null)?.name?.trim() || "Program",
        lessonTitle: (lesson as { title?: string } | null)?.title?.trim() || "Assignment",
        brief: assignmentRow?.brief ?? "",
        submissionInstructions: assignmentRow?.submission_instructions ?? "",
        rubric: assignmentRow?.rubric ?? "",
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
