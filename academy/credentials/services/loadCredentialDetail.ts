import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import type { AcademyCredentialStatus, AcademyCredentialType } from "@/academy/lib/domain";
import { isAcademyCredentialStatus, isAcademyCredentialType } from "../utils/labels";
import { formatCredentialPublicId } from "../utils/publicId";
import type {
  CredentialAssignmentSlot,
  CredentialDetailData,
  CredentialDetailResult,
  CredentialStep,
  CredentialStepState,
} from "../types/detail";
import { loadLatestCredentialReviewNote } from "@/academy/lib/credentialReviewLog";
import {
  certificateLockReason,
  isCertificateLockedByAssignments,
  parseAssignmentStats,
} from "@/academy/assignments/utils/eligibility";

type CredentialRow = {
  id: string;
  user_id: string;
  program_id: string;
  type: string;
  status: string;
  awarded_at: string | null;
  expires_at: string | null;
  certificate_requested_at: string | null;
  certificate_number: string | null;
};

type ProgramRow = { id: string; name: string | null };
type ModuleRow = { id: string; title: string; sort_order: number };
type LessonRow = { id: string; module_id: string; title: string; type: string; sort_order: number };
type ProgressRow = { lesson_id: string; status: string };
type SubmissionRow = {
  lesson_id: string;
  status: string;
};
type AssignmentRow = {
  lesson_id: string;
  brief: string;
  submission_instructions: string;
};

function stepState(index: number, currentIndex: number): CredentialStepState {
  if (index < currentIndex) return "complete";
  if (index === currentIndex) return "current";
  return "upcoming";
}

function buildSteps(input: {
  type: AcademyCredentialType;
  status: AcademyCredentialStatus;
  moduleCount: number;
  learningComplete: boolean;
  approvedSubmissions: number;
  totalAssignments: number;
  assessmentComplete: boolean;
  credentialId: string;
  programId: string;
  nextSubmission: CredentialAssignmentSlot | null;
  certificateRequestedAt: string | null;
}): CredentialStep[] {
  if (input.type === "certificate_of_completion") {
    const assignmentsComplete =
      input.totalAssignments === 0 || input.approvedSubmissions >= input.totalAssignments;
    const reviewComplete = input.status === "awarded";
    const canRequest =
      input.status === "credential_review" && assignmentsComplete && !input.certificateRequestedAt;
    const requested = Boolean(input.certificateRequestedAt) && !reviewComplete;
    const reviewCurrent =
      (input.status === "credential_review" && assignmentsComplete) ||
      (canRequest || requested);
    const assignmentCurrent = !assignmentsComplete;
    return [
      ...(input.totalAssignments > 0
        ? [
            {
              id: "assignments",
              title: "Assignments reviewed",
              detail: `${input.approvedSubmissions} of ${input.totalAssignments} assignments reviewed`,
              state: assignmentsComplete ? "complete" : assignmentCurrent ? "current" : "upcoming",
              action:
                input.nextSubmission && !assignmentsComplete
                  ? {
                      label: "Open assignment →",
                      href: `/academy/learning/${input.programId}/${input.nextSubmission.lessonId}`,
                    }
                  : undefined,
            } satisfies CredentialStep,
          ]
        : []),
      {
        id: "review",
        title: "Certificate Review",
        detail: reviewComplete
          ? "Approved by Academy Admin"
          : requested
            ? "Your request is with Academy Admin — typically within 5 business days"
            : canRequest
              ? "Ready — request your certificate when you are ready"
              : "Complete all assignments before requesting your certificate",
        state: reviewComplete ? "complete" : reviewCurrent ? "current" : "upcoming",
      },
      {
        id: "awarded",
        title: "Certificate Issued",
        detail: reviewComplete ? "Available to view and download" : "Issued after admin approval",
        state: reviewComplete ? "complete" : "upcoming",
      },
    ];
  }

  const steps: Omit<CredentialStep, "state">[] = [
    {
      id: "learning",
      title: "Required Learning",
      detail:
        input.moduleCount === 0
          ? "No modules on this program yet"
          : input.learningComplete
            ? `All ${input.moduleCount} module${input.moduleCount === 1 ? "" : "s"} complete`
            : `Complete all ${input.moduleCount} modules`,
    },
    {
      id: "applied",
      title: "Applied Work & Submissions",
      detail:
        input.totalAssignments === 0
          ? "No applied-work submissions required"
          : `${input.approvedSubmissions} of ${input.totalAssignments} submissions reviewed`,
      action:
        input.nextSubmission && input.learningComplete
          ? {
              label: "Open assignment →",
              href: `/academy/learning/${input.programId}/${input.nextSubmission.lessonId}`,
            }
          : undefined,
    },
    {
      id: "assessment",
      title: "Final Assessment",
      detail: "Proctored, 90 minutes",
    },
    {
      id: "review",
      title: "Credential Review",
      detail: "Academy Admin review, typically 5 business days",
    },
    {
      id: "awarded",
      title: "Credential Awarded",
      detail: "Valid for 3 years from award date",
    },
  ];

  let currentIndex = 0;
  if (input.status === "awarded") {
    currentIndex = steps.length;
  } else if (input.status === "credential_review") {
    currentIndex = 4;
  } else if (input.status === "final_assessment") {
    currentIndex = 2;
  } else if (input.status === "applied_work") {
    currentIndex = 1;
  } else {
    currentIndex = input.learningComplete ? 1 : 0;
  }

  return steps.map((step, index) => ({
    ...step,
    state: stepState(index, currentIndex),
  }));
}

export async function loadCredentialDetail(
  userId: string,
  credentialId: string,
  learnerName: string,
): Promise<CredentialDetailResult> {
  if (!userId || !credentialId) {
    return { ok: false, reason: "not_found" };
  }

  try {
    const supabase = await createClient();

    await supabase.rpc("academy_sync_credential_progress", { p_credential_id: credentialId });

    const { data: credential, error } = await supabase
      .from("academy_credentials")
      .select(
        "id, user_id, program_id, type, status, awarded_at, expires_at, certificate_requested_at, certificate_number",
      )
      .eq("id", credentialId)
      .maybeSingle();

    if (error) return { ok: false, reason: "failed" };

    const row = credential as CredentialRow | null;
    if (!row || !isAcademyCredentialType(row.type) || !isAcademyCredentialStatus(row.status)) {
      return { ok: false, reason: "not_found" };
    }

    if (row.user_id !== userId) {
      return { ok: false, reason: "unauthorized" };
    }

    const [{ data: program }, { data: enrollment }] = await Promise.all([
      supabase.from("academy_programs").select("id, name").eq("id", row.program_id).maybeSingle(),
      supabase
        .from("academy_enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("program_id", row.program_id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const programRow = program as ProgramRow | null;
    const enrollmentId = (enrollment as { id: string } | null)?.id ?? null;

    const { data: modules } = await supabase
      .from("academy_modules")
      .select("id, title, sort_order")
      .eq("program_id", row.program_id)
      .order("sort_order", { ascending: true });

    const moduleRows = (modules ?? []) as ModuleRow[];
    const moduleIds = moduleRows.map((item) => item.id);

    let lessonRows: LessonRow[] = [];
    if (moduleIds.length > 0) {
      const { data: lessons } = await supabase
        .from("academy_lessons")
        .select("id, module_id, title, type, sort_order")
        .in("module_id", moduleIds)
        .order("sort_order", { ascending: true });
      lessonRows = (lessons ?? []) as LessonRow[];
    }

    let progressRows: ProgressRow[] = [];
    if (enrollmentId) {
      const { data: progress } = await supabase
        .from("academy_lesson_progress")
        .select("lesson_id, status")
        .eq("enrollment_id", enrollmentId);
      progressRows = (progress ?? []) as ProgressRow[];
    }

    const completed = new Set(
      progressRows.filter((item) => item.status === "completed").map((item) => item.lesson_id),
    );

    const learningLessons = lessonRows.filter(
      (lesson) => lesson.type !== "quiz" && lesson.type !== "assignment",
    );
    const assignmentLessons = lessonRows.filter((lesson) => lesson.type === "assignment");
    const learningComplete =
      learningLessons.length > 0 && learningLessons.every((lesson) => completed.has(lesson.id));
    const assessmentComplete =
      lessonRows.filter((l) => l.type === "quiz").length === 0 ||
      lessonRows.filter((l) => l.type === "quiz").every((lesson) => completed.has(lesson.id));

    const { data: submissionRows } = await supabase
      .from("academy_applied_work_submissions")
      .select("lesson_id, status")
      .eq("credential_id", credentialId);

    const submissions = (submissionRows ?? []) as SubmissionRow[];
    const submissionByLesson = new Map(submissions.map((item) => [item.lesson_id, item.status]));

    const { data: lessonSubmissions } = await supabase
      .from("academy_assignment_submissions")
      .select("lesson_id, status")
      .eq("user_id", userId)
      .eq("program_id", row.program_id);

    const lessonSubmissionByLesson = new Map(
      ((lessonSubmissions ?? []) as { lesson_id: string; status: string }[]).map((item) => [
        item.lesson_id,
        item.status,
      ]),
    );

    const { data: statsRaw } = await supabase.rpc("academy_program_assignment_stats", {
      p_user_id: userId,
      p_program_id: row.program_id,
      p_credential_id: credentialId,
    });
    const stats = parseAssignmentStats(statsRaw);
    const approvedSubmissions = stats.reviewed;

    const assignmentIds = assignmentLessons.map((item) => item.id);
    let assignmentMeta = new Map<string, AssignmentRow>();
    if (assignmentIds.length > 0) {
      const { data: assignments } = await supabase
        .from("academy_assignments")
        .select("lesson_id, brief, submission_instructions")
        .in("lesson_id", assignmentIds);
      assignmentMeta = new Map(
        ((assignments ?? []) as AssignmentRow[]).map((item) => [item.lesson_id, item]),
      );
    }

    let nextSubmission: CredentialAssignmentSlot | null = null;
    for (let i = 0; i < assignmentLessons.length; i += 1) {
      const lesson = assignmentLessons[i]!;
      const lessonStatus = lessonSubmissionByLesson.get(lesson.id);
      const appliedStatus = submissionByLesson.get(lesson.id);
      const graded =
        lessonStatus === "graded" || appliedStatus === "approved";
      if (graded) continue;
      const meta = assignmentMeta.get(lesson.id);
      const returned =
        lessonStatus === "resubmission_required" || appliedStatus === "returned";
      const submitted =
        lessonStatus === "submitted" ||
        appliedStatus === "submitted" ||
        appliedStatus === "under_review";
      nextSubmission = {
        lessonId: lesson.id,
        index: i + 1,
        total: assignmentLessons.length,
        title: lesson.title,
        brief: meta?.brief?.trim() || lesson.title,
        submissionInstructions: meta?.submission_instructions?.trim() || "",
        submissionStatus: returned ? "returned" : submitted ? "submitted" : "missing",
      };
      break;
    }

    const certificateRequestedAt = row.certificate_requested_at;
    const reviewNote = await loadLatestCredentialReviewNote(row.id);
    const reviewerNote =
      row.status !== "awarded" && reviewNote?.action === "return" ? reviewNote.notes : null;
    const awardNote =
      row.status === "awarded" && reviewNote?.action === "award" ? reviewNote.notes : null;

    const steps = buildSteps({
      type: row.type,
      status: row.status,
      moduleCount: moduleRows.length,
      learningComplete,
      approvedSubmissions,
      totalAssignments: Math.max(assignmentLessons.length, stats.total),
      assessmentComplete,
      credentialId: row.id,
      programId: row.program_id,
      nextSubmission:
        row.status === "applied_work" ||
        (learningComplete && approvedSubmissions < Math.max(assignmentLessons.length, stats.total))
          ? nextSubmission
          : null,
      certificateRequestedAt,
    });

    const showIdentityCard =
      row.type === "cpa_credential" && row.status !== "awarded" && !assessmentComplete;

    const termExpiresLabel = row.expires_at
      ? new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date(row.expires_at))
      : null;

    const data: CredentialDetailData = {
      id: row.id,
      programId: row.program_id,
      programName: programRow?.name?.trim() || "Program",
      type: row.type,
      status: row.status,
      learnerName: learnerName.trim() || "Learner",
      awardedAt: row.awarded_at,
      expiresAt: row.expires_at,
      publicId: row.certificate_number
        ? formatCredentialPublicId(row.type, row.certificate_number)
        : "",
      certificateNumber: row.certificate_number,
      steps,
      showIdentityCard,
      identityCardTitle: "Identity verification",
      identityCardBody:
        "Required for Final Assessment. A short proctoring step is required before the final assessment can be scheduled.",
      termExpiresLabel,
      nextSubmission,
      moduleCount: moduleRows.length,
      approvedSubmissions,
      totalAssignments: Math.max(assignmentLessons.length, stats.total),
      assignmentEligibility: {
        total: stats.total,
        submitted: stats.submitted,
        reviewed: stats.reviewed,
        locked: isCertificateLockedByAssignments(stats) && row.status !== "awarded",
        lockReason:
          row.status !== "awarded" ? certificateLockReason(stats) : null,
      },
      reviewerNote,
      awardNote,
      certificateRequestedAt,
    };

    return { ok: true, data };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function loadSubmitAppliedWork(
  userId: string,
  credentialId: string,
): Promise<
  | { ok: true; credentialId: string; programName: string; slot: CredentialAssignmentSlot }
  | { ok: false; reason: "not_found" | "unauthorized" | "unavailable" | "failed" }
> {
  const detail = await loadCredentialDetail(userId, credentialId, "Learner");
  if (!detail.ok) {
    return {
      ok: false,
      reason: detail.reason === "unauthorized" ? "unauthorized" : "not_found",
    };
  }

  if (!detail.data.nextSubmission) {
    return { ok: false, reason: "unavailable" };
  }

  return {
    ok: true,
    credentialId: detail.data.id,
    programName: detail.data.programName,
    slot: detail.data.nextSubmission,
  };
}
