import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import type { AcademyEnrollmentStatus, AcademyProgramType } from "@/academy/lib/domain";
import type { AcademyInterestId } from "@/academy/onboarding/lib/interests";
import { rankRecommendedPrograms, recommendedAction } from "../lib/rankRecommendations";
import type {
  ContinueLearningItem,
  DashboardLoadResult,
  LearnerDashboardData,
  RecommendedProgram,
} from "../types";

type ProgramEmbed = {
  id: string;
  name: string;
  type: AcademyProgramType;
  category: string | null;
  description?: string | null;
  status?: string;
};

type EnrollmentRow = {
  id: string;
  status: AcademyEnrollmentStatus;
  progress_percent: number;
  program_id: string;
  academy_programs: ProgramEmbed | ProgramEmbed[] | null;
};

type ModuleRow = { id: string; title: string; sort_order: number };
type LessonRow = { id: string; module_id: string; title: string; sort_order: number };
type ProgressRow = { lesson_id: string; status: string };

function asProgram(value: EnrollmentRow["academy_programs"]): ProgramEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function emptyDashboard(): LearnerDashboardData {
  return {
    continueLearning: [],
    recommended: [],
    stats: {
      programsInProgress: 0,
      coursesEnrolled: 0,
      coursesCompleted: 0,
      coursesInProgress: 0,
      lessonsCompleted: 0,
      certificatesEarned: 0,
      credentialsAwarded: 0,
    },
  };
}

async function loadContinueCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: EnrollmentRow,
): Promise<ContinueLearningItem | null> {
  const program = asProgram(row.academy_programs);
  if (!program) return null;

  const { data: modules } = await supabase
    .from("academy_modules")
    .select("id, title, sort_order")
    .eq("program_id", program.id)
    .order("sort_order", { ascending: true });

  const moduleRows = (modules ?? []) as ModuleRow[];
  let headline = program.name;
  let completedLessons: number | null = null;
  let totalLessons: number | null = null;

  if (moduleRows.length > 0) {
    const { data: lessons } = await supabase
      .from("academy_lessons")
      .select("id, module_id, title, sort_order")
      .in(
        "module_id",
        moduleRows.map((item) => item.id),
      )
      .order("sort_order", { ascending: true });

    const lessonRows = (lessons ?? []) as LessonRow[];
    totalLessons = lessonRows.length;

    const { data: progress } = await supabase
      .from("academy_lesson_progress")
      .select("lesson_id, status")
      .eq("enrollment_id", row.id);

    const completed = new Set(
      ((progress ?? []) as ProgressRow[])
        .filter((item) => item.status === "completed")
        .map((item) => item.lesson_id),
    );
    completedLessons = completed.size;

    const lessonsByModule = new Map<string, LessonRow[]>();
    for (const lesson of lessonRows) {
      const list = lessonsByModule.get(lesson.module_id) ?? [];
      list.push(lesson);
      lessonsByModule.set(lesson.module_id, list);
    }

    let lessonIndex = 0;
    outer: for (let moduleIndex = 0; moduleIndex < moduleRows.length; moduleIndex += 1) {
      const moduleRow = moduleRows[moduleIndex]!;
      const moduleLessons = lessonsByModule.get(moduleRow.id) ?? [];
      for (let i = 0; i < moduleLessons.length; i += 1) {
        lessonIndex += 1;
        const lesson = moduleLessons[i]!;
        if (!completed.has(lesson.id)) {
          headline = `Lesson ${lessonIndex}: ${lesson.title.trim() || "Untitled lesson"}`;
          break outer;
        }
      }
    }
  }

  return {
    enrollmentId: row.id,
    programId: program.id,
    programName: program.name,
    programType: program.type,
    status: row.status,
    progressPercent: row.progress_percent,
    headline,
    completedLessons,
    totalLessons,
  };
}

export async function loadLearnerDashboard(
  userId: string,
  interestIds: AcademyInterestId[] = [],
): Promise<DashboardLoadResult> {
  if (!userId) {
    return { ok: true, data: emptyDashboard() };
  }

  try {
    const supabase = await createClient();

    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("academy_enrollments")
      .select(
        "id, status, progress_percent, enrolled_at, program_id, academy_programs ( id, name, type, category, status )",
      )
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false })
      .limit(20);

    if (enrollmentError) return { ok: false };

    const rows = (enrollmentRows ?? []) as EnrollmentRow[];
    const enrolledIds = new Set(rows.map((row) => row.program_id));
    const active = rows
      .filter((row) => row.status !== "completed" && Boolean(asProgram(row.academy_programs)))
      .slice(0, 2);

    const continueLearning = (
      await Promise.all(active.map((row) => loadContinueCard(supabase, row)))
    ).filter((item): item is ContinueLearningItem => Boolean(item));

    const { data: published, error: publishedError } = await supabase
      .from("academy_programs")
      .select("id, name, type, description")
      .eq("status", "published")
      .limit(12);

    if (publishedError) return { ok: false };

    const { data: credentials } = await supabase
      .from("academy_credentials")
      .select("type, status")
      .eq("user_id", userId);

    const awarded = (credentials ?? []) as { type: string; status: string }[];

    const recommended: RecommendedProgram[] = rankRecommendedPrograms(
      (
        (published ?? []) as {
          id: string;
          name: string;
          type: AcademyProgramType;
          description: string | null;
        }[]
      ).filter((program) => !enrolledIds.has(program.id)),
      interestIds,
    ).map((program) => ({
      id: program.id,
      name: program.name,
      description: program.description,
      type: program.type,
      action: recommendedAction(program.type),
    }));

    const programsInProgress = rows.filter((row) => row.status !== "completed").length;
    const coursesEnrolled = rows.length;
    const coursesCompleted = rows.filter((row) => row.status === "completed").length;
    const coursesInProgress = programsInProgress;

    let lessonsCompleted = 0;
    if (rows.length > 0) {
      const enrollmentIds = rows.map((row) => row.id);
      const { count } = await supabase
        .from("academy_lesson_progress")
        .select("id", { count: "exact", head: true })
        .in("enrollment_id", enrollmentIds)
        .eq("status", "completed");
      lessonsCompleted = count ?? 0;
    }

    return {
      ok: true,
      data: {
        continueLearning,
        recommended,
        stats: {
          coursesEnrolled,
          coursesCompleted,
          coursesInProgress,
          lessonsCompleted,
          programsInProgress,
          certificatesEarned: awarded.filter(
            (item) => item.type === "certificate_of_completion" && item.status === "awarded",
          ).length,
          credentialsAwarded: awarded.filter(
            (item) =>
              item.status === "awarded" &&
              (item.type === "cpa_credential" || item.type === "specialty_endorsement"),
          ).length,
        },
      },
    };
  } catch {
    return { ok: false };
  }
}
