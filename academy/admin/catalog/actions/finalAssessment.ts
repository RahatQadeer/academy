"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { isAcademyQuestionType } from "@/academy/lib/domain";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import { findFinalAssessment } from "../lib/finalAssessment";
import { loadCatalogProgram } from "../services/loadCatalogProgram";
import { loadQuestionBank } from "@/academy/lib/questionBank/loadQuestionBank";

export async function addQuestionsToFinalAssessmentAction(input: {
  programId: string;
  questionIds: string[];
}) {
  const programId = input.programId.trim().toLowerCase();
  if (!PROGRAM_ID.test(programId)) {
    return { ok: false as const, message: "Invalid program." };
  }

  const questionIds = [...new Set(input.questionIds.map((id) => id.trim().toLowerCase()))].filter((id) =>
    PROGRAM_ID.test(id),
  );
  if (questionIds.length === 0) {
    return { ok: false as const, message: "Select at least one question." };
  }

  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, message: "Sign in required." };
  const actor = { id: profile.user.id };
  const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
  if (!area || !admin) return { ok: false as const, message: "Admin access required." };

  const loaded = await loadCatalogProgram(programId);
  if (!loaded.ok) return { ok: false as const, message: "Program could not be loaded." };

  const target = findFinalAssessment(loaded.program);
  if (!target) {
    return {
      ok: false as const,
      message: "Add a Final Assessment quiz lesson before importing questions.",
    };
  }

  const supabase = await createClient();
  const { data: sourceRows, error: sourceError } = await supabase
    .from("academy_questions")
    .select("id, quiz_id, question_text, type, options, correct_answer, sort_order")
    .in("id", questionIds);

  if (sourceError || !sourceRows?.length) {
    return { ok: false as const, message: "Selected questions could not be loaded." };
  }

  const { data: existingRows } = await supabase
    .from("academy_questions")
    .select("sort_order")
    .eq("quiz_id", target.quizId)
    .order("sort_order", { ascending: false })
    .limit(1);

  let nextSort = ((existingRows?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;
  const inserts = [];

  for (const row of sourceRows as {
    id: string;
    question_text: string;
    type: string;
    options: unknown;
    correct_answer: string | null;
  }[]) {
    if (!isAcademyQuestionType(row.type)) continue;
    inserts.push({
      quiz_id: target.quizId,
      question_text: row.question_text,
      type: row.type,
      options: row.options,
      correct_answer: row.correct_answer,
      sort_order: nextSort,
    });
    nextSort += 1;
  }

  if (inserts.length === 0) {
    return { ok: false as const, message: "No valid questions to import." };
  }

  const { error: insertError } = await supabase.from("academy_questions").insert(inserts);
  if (insertError) {
    return { ok: false as const, message: "Questions could not be added to the final assessment." };
  }

  revalidatePath(`/academy/admin/programs/${programId}`);
  revalidatePath("/academy/admin/programs");
  return { ok: true as const, added: inserts.length };
}

export async function loadFinalAssessmentBankAction(programId: string) {
  const id = programId.trim().toLowerCase();
  if (!PROGRAM_ID.test(id)) return { ok: false as const, items: [] as never[] };

  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const, items: [] as never[] };
  const actor = { id: profile.user.id };
  const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
  if (!area || !admin) return { ok: false as const, items: [] as never[] };

  const result = await loadQuestionBank({
    userId: profile.user.id,
    scope: "admin",
    filters: { programId: id, page: 1 },
  });
  if (!result.ok) return { ok: false as const, items: [] as never[] };
  return { ok: true as const, items: result.data.items };
}
