import test from "node:test";
import assert from "node:assert/strict";
import {
  assignmentPromptFromBank,
  catalogQuestionFromBank,
  editorQuestionFromBank,
  mergeAssignmentBrief,
} from "./mapAuthoring.ts";
import type { AuthoringBankQuestion } from "./types";

const mcq: AuthoringBankQuestion = {
  id: "q1",
  questionText: "Which fabric is knit?",
  type: "multiple_choice",
  options: [
    { id: "opt-a", label: "Jersey" },
    { id: "opt-b", label: "Denim" },
  ],
  correctAnswer: "opt-a",
  programId: "p1",
  programName: "Fashion",
  moduleTitle: "Module 1",
  lessonTitle: "Quiz 1",
  lessonId: "l1",
};

test("catalogQuestionFromBank maps option ids to labels", () => {
  const mapped = catalogQuestionFromBank(mcq, 3);
  assert.ok(mapped);
  assert.equal(mapped.type, "multiple_choice");
  assert.deepEqual(mapped.options, ["Jersey", "Denim"]);
  assert.equal(mapped.correctAnswer, "Jersey");
  assert.equal(mapped.id, "");
  assert.equal(mapped.sortOrder, 3);
});

test("editorQuestionFromBank keeps option ids for the instructor editor", () => {
  const mapped = editorQuestionFromBank(mcq, 0);
  assert.ok(mapped);
  assert.equal(mapped.correctAnswer, "opt-a");
  assert.equal(mapped.options[0]?.id, "opt-a");
});

test("mergeAssignmentBrief appends unique prompts only", () => {
  const next = mergeAssignmentBrief("Existing brief", [
    "Existing brief",
    "New prompt",
    "New prompt",
  ]);
  assert.equal(next, "Existing brief\n\nNew prompt");
});

test("assignmentPromptFromBank includes choices for quiz items", () => {
  const prompt = assignmentPromptFromBank(mcq);
  assert.match(prompt, /Which fabric is knit/);
  assert.match(prompt, /A\. Jersey/);
  assert.match(prompt, /B\. Denim/);
});

test("assignmentPromptFromBank wraps open prompts as bank-sourced", () => {
  const prompt = assignmentPromptFromBank({
    ...mcq,
    type: "assignment",
    options: [],
    correctAnswer: "",
  });
  assert.match(prompt, /<!--pa-bank-->/);
  assert.match(prompt, /Which fabric is knit\?/);
  assert.match(prompt, /<!--\/pa-bank-->/);
});

test("catalogQuestionFromBank marks fromBank", () => {
  const mapped = catalogQuestionFromBank(mcq, 0);
  assert.ok(mapped);
  assert.equal(mapped.fromBank, true);
});
