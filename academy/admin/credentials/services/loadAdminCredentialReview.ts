import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { credentialTypeLabel, isAcademyCredentialStatus, isAcademyCredentialType } from "@/academy/credentials/utils/labels";
import { ACADEMY_SETTINGS_COOKIE, parseAcademySettings } from "@/academy/admin/settings/lib/defaults";
import { UUID } from "../../types";
import { expiryFromAward, termLabel } from "../lib/format";
import type { AdminCredentialReviewResult, ChecklistItem, TimelineEvent } from "../types";
import { loadLatestCredentialReviewNote } from "@/academy/lib/credentialReviewLog";

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
type ProgramRow = {
  id: string;
  name: string | null;
  credential_validity?: string | null;
};
type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};
type ModuleRow = { id: string; title: string; sort_order: number };
type LessonRow = { id: string; module_id: string; type: string; sort_order: number };
type ProgressRow = { lesson_id: string; status: string; completed_at: string | null };

function displayName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `Learner ${userId.slice(0, 8)}`;
}

function latest(values: (string | null | undefined)[]) {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((item) => !Number.isNaN(item.time))
    .sort((a, b) => b.time - a.time);
  return dates[0]?.value ?? null;
}

export async function loadAdminCredentialReview(
  credentialIdRaw: string,
): Promise<AdminCredentialReviewResult> {
  const credentialId = credentialIdRaw.trim().toLowerCase();
  if (!UUID.test(credentialId)) return { ok: false, reason: "not_found" };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: credential, error: credentialError } = await supabase
      .from("academy_credentials")
      .select(
        "id, user_id, program_id, type, status, awarded_at, expires_at, certificate_requested_at, certificate_number",
      )
      .eq("id", credentialId)
      .maybeSingle();
    if (credentialError) return { ok: false, reason: "failed" };

    const row = credential as CredentialRow | null;
    if (!row || !isAcademyCredentialType(row.type) || !isAcademyCredentialStatus(row.status)) {
      return { ok: false, reason: "not_found" };
    }

    const [{ data: program }, { data: identities, error: identityError }, { data: modules }, { data: enrollments }] =
      await Promise.all([
        supabase.from("academy_programs").select("id, name, credential_validity").eq("id", row.program_id).maybeSingle(),
        supabase.rpc("academy_admin_user_identities", { p_user_ids: [row.user_id] }),
        supabase
          .from("academy_modules")
          .select("id, title, sort_order")
          .eq("program_id", row.program_id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("academy_enrollments")
          .select("id, completed_at")
          .eq("user_id", row.user_id)
          .eq("program_id", row.program_id)
          .order("enrolled_at", { ascending: false })
          .limit(1),
      ]);
    if (identityError) return { ok: false, reason: "failed" };

    const enrollment = ((enrollments ?? []) as { id: string; completed_at: string | null }[])[0] ?? null;
    const moduleRows = (modules ?? []) as ModuleRow[];
    const moduleIds = moduleRows.map((module) => module.id);
    let lessonRows: LessonRow[] = [];
    let progressRows: ProgressRow[] = [];

    if (moduleIds.length > 0) {
      const { data: lessons } = await supabase
        .from("academy_lessons")
        .select("id, module_id, type, sort_order")
        .in("module_id", moduleIds);
      lessonRows = (lessons ?? []) as LessonRow[];
    }

    const enrollmentId = enrollment?.id;
    if (enrollmentId && lessonRows.length > 0) {
      const { data: progress } = await supabase
        .from("academy_lesson_progress")
        .select("lesson_id, status, completed_at")
        .eq("enrollment_id", enrollmentId);
      progressRows = (progress ?? []) as ProgressRow[];
    }

    const progressByLesson = new Map(progressRows.map((item) => [item.lesson_id, item]));
    const completed = (lesson: LessonRow) => progressByLesson.get(lesson.id)?.status === "completed";

    const modulesComplete = moduleRows.filter((module) => {
      const inModule = lessonRows.filter((lesson) => lesson.module_id === module.id);
      return inModule.length > 0 && inModule.every(completed);
    }).length;
    const learningComplete = moduleRows.length > 0 && modulesComplete === moduleRows.length;

    const assignments = lessonRows.filter((lesson) => lesson.type === "assignment");
    const { data: statsRaw } = await supabase.rpc("academy_program_assignment_stats", {
      p_user_id: row.user_id,
      p_program_id: row.program_id,
      p_credential_id: credentialId,
    });
    const assignmentStats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw;
    const assignmentTotal = Number((assignmentStats as { total?: number } | null)?.total ?? assignments.length);
    const assignmentReviewed = Number((assignmentStats as { reviewed?: number } | null)?.reviewed ?? 0);
    const appliedComplete = assignmentTotal === 0 || assignmentReviewed >= assignmentTotal;

    const quizzes = lessonRows.filter((lesson) => lesson.type === "quiz");
    const quizzesDone = quizzes.filter(completed).length;
    const assessmentComplete = quizzes.length === 0 ? learningComplete : quizzesDone === quizzes.length;

    const reachedReview = row.status === "credential_review" || row.status === "awarded";
    const identityComplete = row.type === "cpa_credential" ? reachedReview && assessmentComplete : true;

    const store = await cookies();
    const settings = parseAcademySettings(store.get(ACADEMY_SETTINGS_COOKIE)?.value);
    const identityDetail =
      row.type !== "cpa_credential" || settings.identityProvider === "none"
        ? "Not required for this credential type"
        : identityComplete
          ? "Confirmed prior to final assessment"
          : "Not recorded yet";

    const awarded = row.status === "awarded";

    const checklist: ChecklistItem[] = [
      {
        id: "learning",
        title: "Required Learning",
        detail:
          moduleRows.length === 0
            ? "No modules on this program yet"
            : awarded || learningComplete
              ? `All ${moduleRows.length} module${moduleRows.length === 1 ? "" : "s"} complete`
              : `${modulesComplete} of ${moduleRows.length} modules complete`,
        complete: awarded || learningComplete,
      },
      {
        id: "applied",
        title: "Applied Work & Submissions",
        detail:
          assignmentTotal === 0
            ? "No applied-work lessons in this program"
            : awarded || appliedComplete
              ? `${assignmentTotal} of ${assignmentTotal} reviewed`
              : `${assignmentReviewed} of ${assignmentTotal} reviewed`,
        complete: awarded || appliedComplete,
      },
      {
        id: "assessment",
        title: "Final Assessment",
        detail:
          quizzes.length === 0
            ? "No quiz assessment in this program"
            : awarded || assessmentComplete
              ? "Completed"
              : `${quizzesDone} of ${quizzes.length} complete`,
        complete: awarded || assessmentComplete,
      },
      {
        id: "identity",
        title: "Identity verification",
        detail: identityDetail,
        complete: awarded || identityComplete,
      },
    ];

    const learningAt = latest(
      lessonRows.filter((lesson) => lesson.type !== "quiz" && lesson.type !== "assignment").map((lesson) =>
        progressByLesson.get(lesson.id)?.completed_at,
      ),
    );
    const assessmentAt = latest(
      quizzes.map((lesson) => progressByLesson.get(lesson.id)?.completed_at),
    );
    const submittedAt = enrollment?.completed_at ?? null;

    const timeline: TimelineEvent[] = [
      { id: "learning", label: "Required Learning completed", at: learningComplete ? learningAt : null },
      {
        id: "assessment",
        label: "Final Assessment passed",
        at: assessmentComplete ? assessmentAt : null,
      },
      {
        id: "request",
        label: "Learner requested certificate",
        at: row.certificate_requested_at,
      },
      {
        id: "review",
        label: "In Credential Review",
        at: reachedReview ? submittedAt ?? assessmentAt ?? learningAt : null,
      },
      {
        id: "awarded",
        label: "Credential awarded",
        at: row.awarded_at,
      },
    ].filter((event) => event.at);

    const identity = ((identities ?? []) as IdentityRow[]).find(
      (item) => item.id.toLowerCase() === row.user_id.toLowerCase(),
    );
    const programRow = program as ProgramRow | null;

    const { data: submissionRows } = await supabase
      .from("academy_applied_work_submissions")
      .select("id, summary, status, submitted_at")
      .eq("credential_id", credentialId)
      .order("submitted_at", { ascending: true });

    const submissions = ((submissionRows ?? []) as {
      id: string;
      summary: string;
      status: string;
      submitted_at: string;
    }[]).map((item) => ({
      id: item.id,
      summary: item.summary,
      status: item.status,
      submittedAt: item.submitted_at,
    }));

    const reviewNote = await loadLatestCredentialReviewNote(credentialId);
    const programValidity = programRow?.credential_validity ?? "none";

    // Keep term aligned with the program’s Certificate validity setting.
    let expiresAt = row.expires_at;
    if (row.status === "awarded" && row.awarded_at) {
      if (programValidity === "three_years" && !expiresAt) {
        expiresAt = expiryFromAward(new Date(row.awarded_at));
        await supabase
          .from("academy_credentials")
          .update({ expires_at: expiresAt, renewal_status: "active" })
          .eq("id", credentialId);
      } else if (programValidity !== "three_years" && expiresAt) {
        expiresAt = null;
        await supabase
          .from("academy_credentials")
          .update({ expires_at: null, renewal_status: null })
          .eq("id", credentialId);
      }
    }

    return {
      ok: true,
      data: {
        id: row.id,
        learnerName: displayName(identity, row.user_id),
        credentialName: programRow?.name?.trim() || credentialTypeLabel(row.type),
        type: row.type,
        status: row.status,
        awardedAt: row.awarded_at,
        expiresAt,
        termLabel: termLabel(expiresAt, {
          programValidity,
          awarded: row.status === "awarded",
        }),
        checklist,
        timeline,
        identityProvider: settings.identityProvider,
        submissions,
        reviewNote: reviewNote?.notes ?? null,
        reviewNoteAction: reviewNote?.action ?? null,
        certificateRequestedAt: row.certificate_requested_at,
        certificateNumber: row.certificate_number,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
