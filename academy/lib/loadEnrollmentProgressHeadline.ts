import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcademyProgramType } from "@/academy/lib/domain";

type ModuleRow = { id: string; title: string; sort_order: number };
type LessonRow = { id: string; module_id: string; title: string; sort_order: number };
type ProgressRow = { lesson_id: string; status: string };

export async function loadEnrollmentProgressHeadline(
  supabase: SupabaseClient,
  enrollmentId: string,
  programId: string,
  programType: AcademyProgramType,
): Promise<string | null> {
  const { data: modules } = await supabase
    .from("academy_modules")
    .select("id, title, sort_order")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });

  const moduleRows = (modules ?? []) as ModuleRow[];
  if (moduleRows.length === 0) return null;

  const { data: lessons } = await supabase
    .from("academy_lessons")
    .select("id, module_id, title, sort_order")
    .in(
      "module_id",
      moduleRows.map((item) => item.id),
    )
    .order("sort_order", { ascending: true });

  const lessonRows = (lessons ?? []) as LessonRow[];
  if (lessonRows.length === 0) return null;

  const { data: progress } = await supabase
    .from("academy_lesson_progress")
    .select("lesson_id, status")
    .eq("enrollment_id", enrollmentId);

  const completed = new Set(
    ((progress ?? []) as ProgressRow[])
      .filter((item) => item.status === "completed")
      .map((item) => item.lesson_id),
  );

  const lessonsByModule = new Map<string, LessonRow[]>();
  for (const lesson of lessonRows) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }

  let lessonIndex = 0;
  for (let moduleIndex = 0; moduleIndex < moduleRows.length; moduleIndex += 1) {
    const moduleRow = moduleRows[moduleIndex]!;
    const moduleLessons = lessonsByModule.get(moduleRow.id) ?? [];
    for (let i = 0; i < moduleLessons.length; i += 1) {
      lessonIndex += 1;
      const lesson = moduleLessons[i]!;
      if (!completed.has(lesson.id)) {
        if (programType === "certification_program") {
          return `Module ${moduleIndex + 1}: ${moduleRow.title.trim() || "Untitled module"}`;
        }
        return `Lesson ${lessonIndex}: ${lesson.title.trim() || "Untitled lesson"}`;
      }
    }
  }

  return null;
}
