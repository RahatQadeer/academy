"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { markLessonCompleteAction } from "../actions";
import { lessonPlayerHref } from "../utils/curriculum";
import { markLessonCompleteMessage } from "../utils/messages";
import { useLessonCompletionGate } from "./LessonCompletionGate";

export function MarkCompleteButton({
  programId,
  lessonId,
  nextLessonId = null,
}: {
  programId: string;
  lessonId: string;
  /** When set, advance here after Mark complete succeeds (Brent: auto-next). */
  nextLessonId?: string | null;
}) {
  const router = useRouter();
  const gate = useLessonCompletionGate();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Always start locked; unlock only after scroll / video requirements are met.
  const unlocked = Boolean(gate?.canComplete);
  const disabled = pending || !unlocked;

  return (
    <div className="shrink-0">
      <Button
        type="button"
        variant="dark"
        unsized
        disabled={disabled}
        aria-disabled={disabled}
        title={
          !unlocked
            ? (gate?.hint ?? "Complete the lesson first")
            : nextLessonId
              ? "Mark complete and go to the next lesson"
              : undefined
        }
        className="rounded-[7px] px-3.5 py-2 text-[12.5px] font-medium shadow-[0_1px_2px_rgba(15,15,15,0.06)] transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_6px_14px_rgba(15,15,15,0.12)] disabled:pointer-events-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        onClick={() => {
          if (!unlocked) return;
          setError(null);
          startTransition(async () => {
            const result = await markLessonCompleteAction(programId, lessonId);
            if (result.status === "completed" || result.status === "already_completed") {
              if (nextLessonId) {
                router.push(lessonPlayerHref(programId, nextLessonId));
                return;
              }
              router.refresh();
              return;
            }
            setError(markLessonCompleteMessage(result.reason));
          });
        }}
      >
        {pending ? (nextLessonId ? "Continuing…" : "Saving…") : "Mark complete"}
      </Button>
      {error ? (
        <p className="mt-2 max-w-[16rem] text-right text-[12px] leading-relaxed" style={{ color: "var(--warning-fg)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
