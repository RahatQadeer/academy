"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import type { QuestionBankProgramTarget, QuestionBankAuthorScope } from "@/academy/lib/questionBank/types";
import { AddQuestionModal } from "./AddQuestionModal";
import { AddToAssessmentModal } from "./AddToAssessmentModal";
import { clearAuthoringBankCache } from "./FromBankPicker";

export const QUESTION_BANK_RELOAD_EVENT = "academy-question-bank-reload";

export type AddQuestionDefaults = {
  programId?: string;
};

type ReuseSession = {
  programId?: string;
  questions: { id: string; questionText: string; type: string }[];
};

type AddQuestionContextValue = {
  open: (defaults?: AddQuestionDefaults) => void;
  openReuse: (input: ReuseSession) => void;
  programs: QuestionBankProgramTarget[];
  notice: string | null;
  dismissNotice: () => void;
  /** Bumps after a successful add so lists can clear checkboxes. */
  selectionEpoch: number;
};

const AddQuestionContext = createContext<AddQuestionContextValue | null>(null);

export function useAddQuestion() {
  return useContext(AddQuestionContext);
}

export function AddQuestionComposer({
  programs,
  defaultProgramId,
  scope = "admin",
  children,
}: {
  programs: QuestionBankProgramTarget[];
  defaultProgramId?: string;
  defaultLessonId?: string;
  defaultModuleId?: string;
  scope?: QuestionBankAuthorScope;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [reuse, setReuse] = useState<ReuseSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectionEpoch, setSelectionEpoch] = useState(0);
  const [defaults, setDefaults] = useState<AddQuestionDefaults>({
    programId: defaultProgramId,
  });

  useEffect(() => {
    const stored = window.sessionStorage.getItem("academy-question-bank-notice");
    if (!stored) return;
    window.sessionStorage.removeItem("academy-question-bank-notice");
    setNotice(stored);
  }, []);

  const dismissNotice = useCallback(() => {
    window.sessionStorage.removeItem("academy-question-bank-notice");
    setNotice(null);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismissNotice, 4000);
    return () => window.clearTimeout(timer);
  }, [notice, dismissNotice]);

  const openComposer = useCallback(
    (next?: AddQuestionDefaults) => {
      setDefaults({
        programId: next?.programId ?? defaultProgramId,
      });
      setSession((current) => current + 1);
      setOpen(true);
      dismissNotice();
    },
    [defaultProgramId, dismissNotice],
  );

  const openReuse = useCallback((input: ReuseSession) => {
    setReuse(input);
  }, []);

  const handleAdded = useCallback(
    (message: string, meta?: { programId?: string; reload?: boolean }) => {
      window.sessionStorage.setItem("academy-question-bank-notice", message);
      setOpen(false);
      setReuse(null);
      setNotice(message);
      setSelectionEpoch((current) => current + 1);
      // Only refetch the bank after creating a question — not after copy-to-quiz/assignment.
      if (meta?.reload === false) return;
      clearAuthoringBankCache();
      window.dispatchEvent(
        new CustomEvent(QUESTION_BANK_RELOAD_EVENT, {
          detail: {
            status: "custom" as const,
            programId: "",
            focusProgramId: meta?.programId,
          },
        }),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({ open: openComposer, openReuse, programs, notice, dismissNotice, selectionEpoch }),
    [openComposer, openReuse, programs, notice, dismissNotice, selectionEpoch],
  );

  return (
    <AddQuestionContext.Provider value={value}>
      {children}
      {open ? (
        <AddQuestionModal
          key={session}
          programs={programs}
          defaults={defaults}
          onClose={() => setOpen(false)}
          onAdded={handleAdded}
        />
      ) : null}
      {reuse ? (
        <AddToAssessmentModal
          programs={programs}
          questions={reuse.questions}
          preferredProgramId={reuse.programId}
          scope={scope}
          onClose={() => setReuse(null)}
          onAdded={handleAdded}
        />
      ) : null}
    </AddQuestionContext.Provider>
  );
}

export function AddQuestionButton({
  label = "Add question",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const composer = useAddQuestion();
  if (!composer) return null;
  return (
    <Button variant={variant} onClick={() => composer.open()}>
      {label}
    </Button>
  );
}

export function QuestionBankNotice() {
  const composer = useAddQuestion();
  if (!composer?.notice) return null;
  return (
    <div className="relative mb-5">
      <Callout tone="success" title="Added">
        {composer.notice}
      </Callout>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={composer.dismissNotice}
        className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-[6px] border-0 hover:bg-white/50"
        style={{ color: "var(--success-fg)", background: "transparent" }}
      >
        ×
      </button>
    </div>
  );
}
