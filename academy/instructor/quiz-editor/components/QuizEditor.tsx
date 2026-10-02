"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Callout } from "@/base/components/Callout";
import { FromBankPicker } from "@/academy/components/questionBank/FromBankPicker";
import { editorQuestionFromBank } from "@/academy/lib/questionBank/mapAuthoring";
import type { AuthoringBankQuestion } from "@/academy/lib/questionBank/types";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import { saveQuizDraftAction } from "../actions";
import type { EditorQuestion, QuizEditorData } from "../types";
import { MAX_QUESTIONS } from "../types";
import { moveItem } from "../utils/ordering";
import { QuestionCard } from "./QuestionCard";
import { QuestionList } from "./QuestionList";
import { QuizEditorHeader } from "./QuizEditorHeader";
import { QuizEmptyState } from "./QuizEmptyState";
import { QuizLearnerPreview } from "./QuizLearnerPreview";
import { QuizSaveBar, type QuizSaveState } from "./QuizSaveBar";
import { QuizSettings } from "./QuizSettings";

type DraftQuestion = EditorQuestion & { clientKey: string };

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function toDraft(questions: EditorQuestion[]): DraftQuestion[] {
  return questions.map((question, index) => ({
    ...question,
    clientKey: question.id || newKey(),
    sortOrder: index,
  }));
}

function emptyQuestion(index: number): DraftQuestion {
  return {
    id: "",
    clientKey: newKey(),
    questionText: "",
    type: "multiple_choice",
    options: [
      { id: "opt-a", label: "Option A" },
      { id: "opt-b", label: "Option B" },
    ],
    correctAnswer: "opt-a",
    sortOrder: index,
  };
}

export function QuizEditor({ initial }: { initial: QuizEditorData }) {
  const [passingScore, setPassingScore] = useState(initial.passingScore);
  const [questions, setQuestions] = useState(() => toDraft(initial.questions));
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initial.questions[0]?.id ?? null,
  );
  const [saveState, setSaveState] = useState<QuizSaveState>("saved");
  const [saveMessage, setSaveMessage] = useState<string | undefined>();
  const [saving, startSave] = useTransition();

  const locked = initial.programStatus === "published";
  const selected = useMemo(
    () => questions.find((question) => question.clientKey === selectedKey) ?? null,
    [questions, selectedKey],
  );
  const selectedIndex = selected
    ? questions.findIndex((question) => question.clientKey === selected.clientKey)
    : -1;

  useEffect(() => {
    const draft = toDraft(initial.questions);
    setPassingScore(initial.passingScore);
    setQuestions(draft);
    setSelectedKey(draft[0]?.clientKey ?? null);
    setSaveState("saved");
    setSaveMessage(undefined);
  }, [initial]);

  function markUnsaved() {
    if (locked) return;
    setSaveState("unsaved");
    setSaveMessage(undefined);
  }

  function patchQuestion(key: string, patch: Partial<EditorQuestion>) {
    setQuestions((current) =>
      current.map((question) =>
        question.clientKey === key ? { ...question, ...patch } : question,
      ),
    );
    markUnsaved();
  }

  function addQuestion() {
    if (locked || questions.length >= MAX_QUESTIONS) return;
    const next = emptyQuestion(questions.length);
    setQuestions((current) => [...current, next]);
    setSelectedKey(next.clientKey);
    markUnsaved();
  }

  function addFromBank(picked: AuthoringBankQuestion[]) {
    if (locked) return;
    const existingTexts = new Set(
      questions.map((question) => question.questionText.trim().toLowerCase()).filter(Boolean),
    );
    const next = [...questions];
    let lastKey: string | null = null;
    for (const item of picked) {
      if (next.length >= MAX_QUESTIONS) break;
      const mapped = editorQuestionFromBank(item, next.length);
      if (!mapped) continue;
      const key = mapped.questionText.trim().toLowerCase();
      if (!key || existingTexts.has(key)) continue;
      existingTexts.add(key);
      const draft: DraftQuestion = { ...mapped, clientKey: newKey() };
      next.push(draft);
      lastKey = draft.clientKey;
    }
    if (next.length === questions.length) return;
    setQuestions(next);
    if (lastKey) setSelectedKey(lastKey);
    markUnsaved();
  }

  function removeQuestion(key: string) {
    if (locked) return;
    setQuestions((current) => {
      const next = current.filter((question) => question.clientKey !== key);
      return next.map((question, index) => ({ ...question, sortOrder: index }));
    });
    setSelectedKey((current) => (current === key ? null : current));
    markUnsaved();
  }

  function moveQuestion(from: number, to: number) {
    if (locked) return;
    setQuestions((current) =>
      moveItem(current, from, to).map((question, index) => ({ ...question, sortOrder: index })),
    );
    markUnsaved();
  }

  function save() {
    startSave(async () => {
      setSaveState("saving");
      setSaveMessage(undefined);
      const result = await saveQuizDraftAction({
        programId: initial.programId,
        lessonId: initial.lessonId,
        passingScore,
        questions: questions.map((question) => ({
          id: PROGRAM_ID.test(question.id) ? question.id : null,
          questionText: question.questionText,
          type: question.type,
          options: question.options,
          correctAnswer: question.correctAnswer,
          fromBank: question.fromBank,
        })),
      });
      if (!result.ok) {
        setSaveState("error");
        setSaveMessage(result.message || "The quiz draft could not be saved.");
        return;
      }
      const draft = toDraft(result.data.questions);
      setPassingScore(result.data.passingScore);
      setQuestions(draft);
      setSelectedKey(draft[Math.max(0, selectedIndex)]?.clientKey ?? draft[0]?.clientKey ?? null);
      setSaveState("saved");
      setSaveMessage("Saved");
    });
  }

  return (
    <div className="space-y-6 px-6 py-10 lg:px-14">
      <QuizEditorHeader
        programId={initial.programId}
        programName={initial.programName}
        lessonTitle={initial.lessonTitle}
      />
      {locked ? (
        <Callout tone="warning" title="This program is live">
          Published programs cannot be edited here. Submit later changes through the Course Builder
          after they are approved.
        </Callout>
      ) : null}
      <Callout tone="info" title="Learners never see answers">
        Question text and options are learner-facing. Do not put the answer in the question — keep it in
        Correct answer only. Learners get Correct / Incorrect after submit, not the key.
      </Callout>
      <QuizSaveBar
        state={saving ? "saving" : saveState}
        message={saveMessage}
        disabled={locked}
        onSave={save}
      />
      <QuizSettings
        passingScore={passingScore}
        disabled={locked}
        onChange={(value) => {
          setPassingScore(value);
          markUnsaved();
        }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <aside
          className="rounded-[10px] bg-surface p-4"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[13.5px] font-medium">Questions</h2>
            <div className="flex items-center gap-2">
              <FromBankPicker
                kind="quiz"
                programId={initial.programId}
                excludeIds={questions.map((question) => question.id).filter(Boolean)}
                excludeTexts={questions.map((question) => question.questionText)}
                disabled={locked || questions.length >= MAX_QUESTIONS}
                remaining={Math.max(0, MAX_QUESTIONS - questions.length)}
                label="From bank"
                onPick={addFromBank}
              />
              <button
                type="button"
                disabled={locked || questions.length >= MAX_QUESTIONS}
                className="text-[12.5px] disabled:opacity-30"
                style={{ color: "var(--accent)" }}
                onClick={addQuestion}
              >
                Add
              </button>
            </div>
          </div>
          <QuestionList
            questions={questions}
            selectedKey={selectedKey}
            disabled={locked}
            onSelect={setSelectedKey}
            onMove={moveQuestion}
            onRemove={removeQuestion}
          />
        </aside>
        <div className="space-y-6">
          {questions.length === 0 ? (
            <QuizEmptyState
              onAdd={addQuestion}
              fromBank={
                <FromBankPicker
                  kind="quiz"
                  programId={initial.programId}
                  disabled={locked}
                  remaining={MAX_QUESTIONS}
                  onPick={addFromBank}
                />
              }
              disabled={locked}
            />
          ) : selected ? (
            <QuestionCard
              question={selected}
              index={Math.max(0, selectedIndex)}
              groupKey={selected.clientKey}
              disabled={locked}
              onChange={(patch) => patchQuestion(selected.clientKey, patch)}
            />
          ) : (
            <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              Select a question to edit it.
            </p>
          )}
          {questions.length > 0 ? <QuizLearnerPreview questions={questions} /> : null}
        </div>
      </div>
    </div>
  );
}
