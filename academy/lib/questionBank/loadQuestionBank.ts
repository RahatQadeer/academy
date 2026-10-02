import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { isAcademyQuestionType } from "@/academy/lib/domain";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";
import { isGeneralBankProgram } from "./generalBankConstants";
import type {
  QuestionBankFilters,
  QuestionBankItem,
  QuestionBankLoadResult,
  QuestionBankQuestionType,
  QuestionBankStatusFilter,
  QuestionBankSummary,
} from "./types";
import { QUESTION_BANK_PAGE_SIZE } from "./types";

const EMPTY_SUMMARY: QuestionBankSummary = {
  total: 0,
  multipleChoice: 0,
  trueFalse: 0,
  exercise: 0,
  assignment: 0,
  other: 0,
  custom: 0,
  programCount: 0,
};

type RpcQuestionRow = {
  id: string;
  questionText: string;
  type: string;
  optionCount: number;
  programId: string;
  programName: string;
  moduleId: string | null;
  moduleTitle: string;
  lessonId: string | null;
  lessonTitle: string;
  lessonType?: string | null;
  quizId: string | null;
  sortOrder: number;
  custom?: boolean;
};

type RpcPayload = {
  items: RpcQuestionRow[] | null;
  total: number;
  page: number;
  pageSize: number;
  summary: QuestionBankSummary;
  programs: { id: string; name: string; questionCount?: number }[] | null;
  modules: { id: string; title: string; programId: string }[] | null;
};

function parseType(value: string | undefined): QuestionBankFilters["type"] {
  if (
    value === "multiple_choice" ||
    value === "true_false" ||
    value === "exercise" ||
    value === "assignment" ||
    value === "other"
  ) {
    return value;
  }
  return "all";
}

function normalizeType(value: string): QuestionBankQuestionType {
  if (
    value === "multiple_choice" ||
    value === "true_false" ||
    value === "exercise" ||
    value === "assignment" ||
    value === "other" ||
    isAcademyQuestionType(value)
  ) {
    return value as QuestionBankQuestionType;
  }
  return "other";
}

function parseStatus(value: string | undefined): QuestionBankStatusFilter {
  if (value === "in_quiz" || value === "all" || value === "library") return "in_quiz";
  // Custom is the default landing — bank rows only (fast RPC path).
  return "custom";
}

function parseFilters(input: Partial<QuestionBankFilters>): QuestionBankFilters {
  const page = Math.max(1, Number(input.page) || 1);
  return {
    search: (input.search ?? "").trim(),
    type: parseType(input.type),
    programId: (input.programId ?? "").trim(),
    moduleId: (input.moduleId ?? "").trim(),
    status: parseStatus(input.status),
    page,
  };
}

function mapRpcItem(row: RpcQuestionRow): QuestionBankItem {
  const custom = Boolean(row.custom) || row.lessonType === "bank";
  const general = isGeneralBankProgram({ name: row.programName });
  return {
    id: row.id,
    questionText: stripQuizAnswerLeaks(row.questionText),
    type: normalizeType(row.type),
    correctAnswer: "",
    optionCount: row.optionCount,
    programId: row.programId,
    programName: general ? "General" : row.programName,
    moduleId: row.moduleId ?? "",
    moduleTitle: custom ? (general ? "General questions" : "Saved for later") : row.moduleTitle,
    lessonId: row.lessonId ?? "",
    lessonTitle: custom ? "Not in a quiz yet" : row.lessonTitle,
    lessonType: row.lessonType ?? null,
    quizId: row.quizId ?? null,
    sortOrder: row.sortOrder,
    custom,
    inUse: false,
  };
}

async function loadAuthorableProgramOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: "instructor" | "admin",
  userId: string,
): Promise<{ id: string; name: string; questionCount?: number }[]> {
  if (scope === "admin") {
    const { data } = await supabase.from("academy_programs").select("id, name").order("name").limit(400);
    return ((data ?? []) as { id: string; name: string }[]).map((row) => ({
      id: row.id,
      name: row.name,
    }));
  }

  const [{ data: assigned }, { data: created }] = await Promise.all([
    supabase.from("academy_instructor_assignments").select("program_id").eq("user_id", userId),
    supabase.from("academy_programs").select("id").eq("created_by_user_id", userId),
  ]);

  const ids = new Set<string>();
  for (const row of (assigned ?? []) as { program_id: string }[]) {
    if (row.program_id) ids.add(row.program_id);
  }
  for (const row of (created ?? []) as { id: string }[]) {
    if (row.id) ids.add(row.id);
  }
  if (ids.size === 0) return [];

  const { data: programs } = await supabase
    .from("academy_programs")
    .select("id, name")
    .in("id", [...ids])
    .order("name")
    .limit(400);

  return ((programs ?? []) as { id: string; name: string }[]).map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

export async function loadQuestionBank(input: {
  userId: string;
  scope: "instructor" | "admin";
  filters?: Partial<QuestionBankFilters>;
}): Promise<QuestionBankLoadResult> {
  if (!input.userId) return { ok: false, reason: "unauthorized" };

  try {
    const supabase = await createClient();
    const filters = parseFilters(input.filters ?? {});
    const status: QuestionBankStatusFilter =
      filters.status === "in_quiz" ? "in_quiz" : "custom";

    // Library without a course: skip the all-programs outline scan.
    if (status === "in_quiz" && !filters.programId) {
      const programs = await loadAuthorableProgramOptions(supabase, input.scope, input.userId);
      return {
        ok: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: QUESTION_BANK_PAGE_SIZE,
          summary: { ...EMPTY_SUMMARY, programCount: programs.length },
          filters: { programs, modules: [] },
          activeFilters: { ...filters, status, moduleId: "" },
        },
      };
    }

    const { data, error } = await supabase.rpc("academy_list_question_bank", {
      p_scope: input.scope,
      p_search: filters.search,
      p_type: filters.type,
      p_program_id: filters.programId || null,
      p_module_id: status === "custom" ? null : filters.moduleId || null,
      p_page: filters.page,
      p_page_size: QUESTION_BANK_PAGE_SIZE,
      p_status: status,
    });

    if (error || !data) {
      return { ok: false, reason: "failed" };
    }

    const payload = data as RpcPayload;
    const summary = {
      ...EMPTY_SUMMARY,
      ...(payload.summary ?? {}),
      exercise: payload.summary?.exercise ?? 0,
      assignment: payload.summary?.assignment ?? 0,
      other: payload.summary?.other ?? 0,
      custom: payload.summary?.custom ?? 0,
    };

    return {
      ok: true,
      data: {
        items: (payload.items ?? []).map(mapRpcItem),
        total: payload.total ?? 0,
        page: payload.page ?? filters.page,
        pageSize: payload.pageSize ?? QUESTION_BANK_PAGE_SIZE,
        summary,
        filters: {
          programs: payload.programs ?? [],
          modules: payload.modules ?? [],
        },
        activeFilters: { ...filters, status },
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
