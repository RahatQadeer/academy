import test from "node:test";
import assert from "node:assert/strict";
import { hasQuestionBankActiveFilters } from "./filters.ts";
import { parseQuestionBankSearchParams, questionBankHref } from "./href.ts";
import type { QuestionBankFilters } from "./types.ts";

const custom: QuestionBankFilters = {
  search: "",
  type: "all",
  programId: "",
  moduleId: "",
  status: "custom",
  page: 1,
};

test("custom is the default URL and is not an active filter chip", () => {
  assert.equal(hasQuestionBankActiveFilters(custom), false);
  assert.equal(questionBankHref("/academy/admin/question-bank", custom), "/academy/admin/question-bank");
  assert.equal(parseQuestionBankSearchParams({}).status, "");
  assert.equal(parseQuestionBankSearchParams({ status: "unused" }).status, "custom");
});

test("library status round-trips in the URL", () => {
  const filters: QuestionBankFilters = { ...custom, status: "in_quiz" };
  assert.equal(questionBankHref("/academy/admin/question-bank", filters), "/academy/admin/question-bank?status=in_quiz");
  assert.equal(parseQuestionBankSearchParams({ status: "in_quiz" }).status, "in_quiz");
});
