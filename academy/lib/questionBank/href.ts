import type { QuestionBankFilters } from "./types";

export const INSTRUCTOR_QUESTION_BANK_PATH = "/academy/instructor/question-bank";
export const ADMIN_QUESTION_BANK_PATH = "/academy/admin/question-bank";

export function questionBankHref(
  basePath: string,
  filters: Partial<QuestionBankFilters> = {},
) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("q", filters.search.trim());
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.programId) params.set("programId", filters.programId);
  if (filters.moduleId) params.set("moduleId", filters.moduleId);
  // Custom is the default (fast). Library is explicit in the URL.
  if (filters.status === "in_quiz") params.set("status", "in_quiz");
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function parseQuestionBankSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Partial<QuestionBankFilters> {
  const first = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const page = Number(first("page"));
  return {
    search: first("q"),
    type: first("type") as QuestionBankFilters["type"],
    programId: first("programId"),
    moduleId: first("moduleId"),
    status:
      first("status") === "unused" || first("status") === "custom"
        ? "custom"
        : first("status") === "in_quiz" || first("status") === "all" || first("status") === "library"
          ? "in_quiz"
          : (first("status") as QuestionBankFilters["status"]),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}
