import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessInstructorArea, isInstructor } from "@/academy/lib/authorization";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { AssignmentWriteResult } from "@/academy/assignments/types";
import { asAssignmentReason } from "@/academy/lesson-player/services/rpc";

export async function gradeInstructorAssignment(input: {
  submissionId: string;
  score: number;
  maxScore: number;
  feedback: string;
}): Promise<AssignmentWriteResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable", reason: "failed" };
  if (!PROGRAM_ID.test(input.submissionId)) return { status: "unavailable", reason: "not_found" };
  if (!Number.isFinite(input.score) || !Number.isFinite(input.maxScore) || input.maxScore <= 0) {
    return { status: "unavailable", reason: "invalid_score" };
  }
  if (input.maxScore > 100 || input.score < 0 || input.score > input.maxScore || input.score > 100) {
    return { status: "unavailable", reason: "invalid_score" };
  }

  const profile = await getSessionProfile();
  if (!profile) return { status: "unavailable", reason: "unauthenticated" };
  const actor = { id: profile.user.id };
  const [area, instructor] = await Promise.all([
    canAccessInstructorArea(actor),
    isInstructor(actor),
  ]);
  if (!area || !instructor) return { status: "unavailable", reason: "unauthorized" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("academy_grade_assignment", {
      p_submission_id: input.submissionId,
      p_score: input.score,
      p_feedback: input.feedback.trim(),
      p_max_score: input.maxScore,
    });
    if (error) return { status: "unavailable", reason: "failed" };
    const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
      status?: string;
      reason?: string;
    } | null;
    if (payload?.status !== "ok") {
      return { status: "unavailable", reason: asAssignmentReason(payload?.reason) };
    }
    return { status: "ok" };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}

export async function requestInstructorResubmission(input: {
  submissionId: string;
  feedback: string;
}): Promise<AssignmentWriteResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable", reason: "failed" };
  if (!PROGRAM_ID.test(input.submissionId)) return { status: "unavailable", reason: "not_found" };
  if (!input.feedback.trim()) return { status: "unavailable", reason: "feedback_required" };

  const profile = await getSessionProfile();
  if (!profile) return { status: "unavailable", reason: "unauthenticated" };
  const actor = { id: profile.user.id };
  const [area, instructor] = await Promise.all([
    canAccessInstructorArea(actor),
    isInstructor(actor),
  ]);
  if (!area || !instructor) return { status: "unavailable", reason: "unauthorized" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("academy_request_assignment_resubmission", {
      p_submission_id: input.submissionId,
      p_feedback: input.feedback.trim(),
    });
    if (error) return { status: "unavailable", reason: "failed" };
    const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
      status?: string;
      reason?: string;
    } | null;
    if (payload?.status !== "ok") {
      return { status: "unavailable", reason: asAssignmentReason(payload?.reason) };
    }
    return { status: "ok" };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}
