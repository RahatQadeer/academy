import type { QuestionBankFilters } from "./types";

export function hasQuestionBankActiveFilters(filters: QuestionBankFilters) {
  return (
    Boolean(filters.search.trim()) ||
    filters.type !== "all" ||
    Boolean(filters.programId) ||
    Boolean(filters.moduleId)
  );
}
