import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessInstructorArea, isInstructor } from "@/academy/lib/authorization";
import { isAcademyAssignmentSubmissionStatus } from "@/academy/lib/domain";
import type {
  InstructorReviewQueueItem,
  InstructorReviewQueueResult,
} from "../types";
import { REVIEW_QUEUE_LIMIT } from "../types";
import { parseReviewStatus } from "../utils/href";

type SubmissionRow = {
  id: string;
  assignment_id: string;
  lesson_id: string;
  program_id: string;
  user_id: string;
  status: string;
  submitted_at: string | null;
  graded_at: string | null;
  score: number | string | null;
  max_score: number | string | null;
  attempt_count: number;
};

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

export async function loadInstructorReviewQueue(input: {
  userId: string;
  status?: string;
  programId?: string;
  assignmentId?: string;
  learner?: string;
}): Promise<InstructorReviewQueueResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile || profile.user.id !== input.userId) {
      return { ok: false, reason: "unauthorized" };
    }
    const actor = { id: profile.user.id };
    const [area, instructor] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
    ]);
    if (!area || !instructor) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();

    const [{ data: assigned }, { data: created }] = await Promise.all([
      supabase
        .from("academy_instructor_assignments")
        .select("program_id, academy_programs ( id, name )")
        .eq("user_id", input.userId),
      supabase.from("academy_programs").select("id, name").eq("created_by_user_id", input.userId),
    ]);

    const programs = new Map<string, string>();
    for (const row of (assigned ?? []) as {
      program_id: string;
      academy_programs: { id: string; name: string } | { id: string; name: string }[] | null;
    }[]) {
      const program = Array.isArray(row.academy_programs)
        ? row.academy_programs[0]
        : row.academy_programs;
      if (program) programs.set(program.id, program.name);
    }
    for (const row of (created ?? []) as { id: string; name: string }[]) {
      programs.set(row.id, row.name);
    }

    const programIds = [...programs.keys()];
    if (programIds.length === 0) {
      return {
        ok: true,
        data: {
          items: [],
          pendingCount: 0,
          counts: { submitted: 0, graded: 0, resubmission_required: 0, all: 0 },
          filters: { programs: [], assignments: [] },
          truncated: false,
          activeStatus: parseReviewStatus(input.status),
        },
      };
    }

    const { data: moduleRows } = await supabase
      .from("academy_modules")
      .select("id, program_id")
      .in("program_id", programIds);
    const modules = (moduleRows ?? []) as { id: string; program_id: string }[];
    const moduleIds = modules.map((row) => row.id);

    const { data: lessonRows } =
      moduleIds.length > 0
        ? await supabase.from("academy_lessons").select("id, title, module_id").in("module_id", moduleIds)
        : { data: [] as { id: string; title: string; module_id: string }[] };

    const lessons = (lessonRows ?? []) as { id: string; title: string; module_id: string }[];
    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    const programByModule = new Map(modules.map((module) => [module.id, module.program_id]));

    const lessonIds = lessons.map((lesson) => lesson.id);
    const { data: assignmentRows } =
      lessonIds.length > 0
        ? await supabase.from("academy_assignments").select("id, lesson_id").in("lesson_id", lessonIds)
        : { data: [] as { id: string; lesson_id: string }[] };

    const assignments = ((assignmentRows ?? []) as { id: string; lesson_id: string }[]).map((row) => {
      const lesson = lessonById.get(row.lesson_id);
      const programId = lesson ? programByModule.get(lesson.module_id) ?? "" : "";
      return {
        id: row.id,
        title: lesson?.title || "Assignment",
        programId,
      };
    });

    const statusFilter = parseReviewStatus(input.status);

    let query = supabase
      .from("academy_assignment_submissions")
      .select(
        "id, assignment_id, lesson_id, program_id, user_id, status, submitted_at, graded_at, score, max_score, attempt_count",
      )
      .in("program_id", programIds)
      .neq("status", "draft")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(REVIEW_QUEUE_LIMIT + 1);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (input.programId) query = query.eq("program_id", input.programId);
    if (input.assignmentId) query = query.eq("assignment_id", input.assignmentId);

    const [
      { data: rows, error },
      { count: pendingCount },
      { count: gradedCount },
      { count: resubmitCount },
      { count: allCount },
    ] = await Promise.all([
      query,
      supabase
        .from("academy_assignment_submissions")
        .select("id", { count: "exact", head: true })
        .in("program_id", programIds)
        .eq("status", "submitted"),
      supabase
        .from("academy_assignment_submissions")
        .select("id", { count: "exact", head: true })
        .in("program_id", programIds)
        .eq("status", "graded"),
      supabase
        .from("academy_assignment_submissions")
        .select("id", { count: "exact", head: true })
        .in("program_id", programIds)
        .eq("status", "resubmission_required"),
      supabase
        .from("academy_assignment_submissions")
        .select("id", { count: "exact", head: true })
        .in("program_id", programIds)
        .neq("status", "draft"),
    ]);

    if (error) return { ok: false, reason: "failed" };

    const submissions = (rows ?? []) as SubmissionRow[];
    const truncated = submissions.length > REVIEW_QUEUE_LIMIT;
    const visible = submissions.slice(0, REVIEW_QUEUE_LIMIT);
    const userIds = [...new Set(visible.map((row) => row.user_id))];

    const { data: identities } =
      userIds.length > 0
        ? await supabase.rpc("academy_author_learner_identities", { p_user_ids: userIds })
        : { data: [] as IdentityRow[] };

    const identityById = new Map(
      ((identities ?? []) as IdentityRow[]).map((row) => [row.id.toLowerCase(), row]),
    );

    const learnerQuery = (input.learner ?? "").trim().toLowerCase();
    const items: InstructorReviewQueueItem[] = [];
    for (const row of visible) {
      if (!isAcademyAssignmentSubmissionStatus(row.status) || row.status === "draft") continue;
      const identity = identityById.get(row.user_id.toLowerCase());
      const learnerName = displayName(identity, row.user_id);
      if (
        learnerQuery &&
        !learnerName.toLowerCase().includes(learnerQuery) &&
        !(identity?.email ?? "").toLowerCase().includes(learnerQuery)
      ) {
        continue;
      }
      items.push({
        id: row.id,
        assignmentId: row.assignment_id,
        lessonId: row.lesson_id,
        programId: row.program_id,
        userId: row.user_id,
        status: row.status,
        submittedAt: row.submitted_at,
        gradedAt: row.graded_at,
        score: asScore(row.score),
        maxScore: asScore(row.max_score) ?? 100,
        learnerName,
        learnerEmail: identity?.email ?? null,
        programName: programs.get(row.program_id) || "Program",
        lessonTitle: lessonById.get(row.lesson_id)?.title || "Assignment",
        attemptCount: row.attempt_count ?? 0,
      });
    }

    return {
      ok: true,
      data: {
        items,
        pendingCount: pendingCount ?? 0,
        counts: {
          submitted: pendingCount ?? 0,
          graded: gradedCount ?? 0,
          resubmission_required: resubmitCount ?? 0,
          all: allCount ?? 0,
        },
        filters: {
          programs: [...programs.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          assignments,
        },
        truncated,
        activeStatus: statusFilter,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
