"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { LessonExercise } from "@/academy/lib/lessonExercise";
import { EXERCISE_BLANK, shuffleExerciseOptions } from "@/academy/lib/lessonExercise";

type Status = "idle" | "correct" | "incorrect";

export function ExerciseBlock({ exercise }: { exercise: LessonExercise }) {
  const chips = useMemo(
    () =>
      shuffleExerciseOptions(
        exercise.options,
        `${exercise.prompt}|${exercise.options.join("|")}|${exercise.answer}`,
      ),
    [exercise],
  );

  const [placed, setPlaced] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const locked = status === "correct";
  const pool = chips.filter((chip) => chip !== placed);
  const answerVisible = showAnswer || locked;

  function place(option: string) {
    if (locked) return;
    setPlaced(option);
    setStatus("idle");
  }

  function clearBlank() {
    if (locked) return;
    setPlaced(null);
    setStatus("idle");
  }

  function onSubmit() {
    if (!placed || locked) return;
    setStatus(placed === exercise.answer ? "correct" : "incorrect");
  }

  function onShowAnswer() {
    setShowAnswer(true);
    setPlaced(exercise.answer);
    setStatus("correct");
  }

  const lines = exercise.code.replace(/\n$/, "").split("\n");

  return (
    <section
      className="w-full min-w-0 max-w-full overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "rgba(35,131,226,.28)",
        background: "linear-gradient(180deg, #1e2430 0%, #252b38 100%)",
        color: "#f5f5f4",
      }}
    >
      <header className="flex items-center justify-center gap-2 px-4 pt-5 pb-2 sm:px-5">
        <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Exercise</h3>
        <span
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.75)" }}
          title="Drag or tap a chip into the blank, then submit — or show the answer if you are stuck"
          aria-hidden
        >
          ?
        </span>
      </header>

      <p
        className="px-4 pb-4 text-center text-[14.5px] leading-[1.65] text-pretty break-words sm:px-5"
        style={{ color: "rgba(255,255,255,.88)" }}
      >
        {exercise.prompt}
      </p>

      <div className="min-w-0 px-4 sm:px-5">
        <div
          className="min-w-0 overflow-hidden rounded-[8px] px-3 py-3.5 font-mono text-[12.5px] leading-[1.8] sm:px-4 sm:text-[13.5px]"
          style={{ background: "rgba(255,255,255,.08)" }}
          onDragOver={(event) => {
            if (locked) return;
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (locked) return;
            event.preventDefault();
            const value = event.dataTransfer.getData("text/plain");
            if (value && exercise.options.includes(value)) place(value);
            setDragging(null);
          }}
        >
          {lines.map((line, lineIndex) => (
            <CodeLine
              key={`line-${lineIndex}`}
              line={line}
              placed={placed}
              locked={locked}
              onClear={clearBlank}
              dropHighlight={Boolean(dragging)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 px-4 py-5 sm:px-5">
        {pool.map((option) => (
          <button
            key={option}
            type="button"
            draggable={!locked}
            disabled={locked}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", option);
              event.dataTransfer.effectAllowed = "move";
              setDragging(option);
            }}
            onDragEnd={() => setDragging(null)}
            onClick={() => place(option)}
            className="max-w-full rounded-[8px] px-3.5 py-2 text-left text-[13px] font-medium leading-snug break-words transition-transform active:scale-[0.98]"
            style={{
              background: "rgba(255,255,255,.12)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,.14)",
              cursor: locked ? "default" : "grab",
              overflowWrap: "anywhere",
            }}
          >
            {option}
          </button>
        ))}
        {pool.length === 0 && !locked ? (
          <p className="text-[12.5px]" style={{ color: "rgba(255,255,255,.55)" }}>
            Tap the blank to put a chip back
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col items-center gap-2.5 px-4 pb-5 sm:px-5">
        {status === "correct" && !showAnswer ? (
          <p className="text-[13.5px] font-medium" style={{ color: "#7dcea0" }}>
            Correct
          </p>
        ) : null}
        {status === "incorrect" ? (
          <p className="px-1 text-center text-[13.5px] font-medium text-pretty" style={{ color: "#f0c674" }}>
            Not quite — try another option, or show the answer
          </p>
        ) : null}

        {answerVisible ? (
          <div
            className="w-full min-w-0 max-w-md rounded-[8px] border px-3.5 py-3 text-left"
            style={{
              borderColor: "rgba(125,206,160,.35)",
              background: "rgba(125,206,160,.12)",
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#7dcea0" }}>
              Answer
            </p>
            <p
              className="mt-1 text-[14px] font-medium break-words"
              style={{ color: "#fff", overflowWrap: "anywhere" }}
            >
              {exercise.answer}
            </p>
            {exercise.explanation ? (
              <p
                className="mt-2 text-[13px] leading-[1.55] break-words"
                style={{ color: "rgba(255,255,255,.82)", overflowWrap: "anywhere" }}
              >
                {exercise.explanation}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={!placed || locked}
            onClick={onSubmit}
            className="rounded-[8px] px-5 py-2.5 text-[14px] font-semibold transition-opacity disabled:opacity-40"
            style={{
              background: locked ? "rgba(125,206,160,.35)" : "var(--accent, #2383e2)",
              color: "#fff",
            }}
          >
            {locked ? "Answer submitted" : "Submit answer"}
          </button>
          {!answerVisible ? (
            <button
              type="button"
              onClick={onShowAnswer}
              className="rounded-[8px] border px-4 py-2.5 text-[13.5px] font-medium"
              style={{
                borderColor: "rgba(255,255,255,.22)",
                color: "rgba(255,255,255,.9)",
                background: "rgba(255,255,255,.06)",
              }}
            >
              Show answer
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CodeLine({
  line,
  placed,
  locked,
  onClear,
  dropHighlight,
}: {
  line: string;
  placed: string | null;
  locked: boolean;
  onClear: () => void;
  dropHighlight: boolean;
}) {
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const rest = line.slice(indent.length);
  const indentPad = Math.min(indent.length, 12) * 0.55;

  return (
    <div
      className="min-w-0 max-w-full whitespace-pre-wrap break-words"
      style={{
        color: "rgba(255,255,255,.92)",
        overflowWrap: "anywhere",
        paddingLeft: indentPad ? `${indentPad}em` : undefined,
      }}
    >
      {renderCodeRest(rest || (indent ? "" : "\u00a0"), { placed, locked, onClear, dropHighlight })}
    </div>
  );
}

function renderCodeRest(
  rest: string,
  ctx: {
    placed: string | null;
    locked: boolean;
    onClear: () => void;
    dropHighlight: boolean;
  },
) {
  const parts = rest.split(EXERCISE_BLANK);
  if (parts.length === 1) {
    return rest || "\u00a0";
  }

  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part) {
      nodes.push(<span key={`t-${index}`}>{part}</span>);
    }
    if (index < parts.length - 1) {
      nodes.push(
        <button
          key={`blank-${index}`}
          type="button"
          disabled={ctx.locked && Boolean(ctx.placed)}
          onClick={() => {
            if (ctx.placed) ctx.onClear();
          }}
          className="mx-0.5 inline-block max-w-full align-baseline rounded-[6px] px-2 py-0.5 text-left text-[12.5px] font-medium leading-snug break-words"
          style={{
            background: ctx.placed ? "rgba(35,131,226,.45)" : "rgba(0,0,0,.45)",
            border: `1px dashed ${
              ctx.dropHighlight && !ctx.placed ? "var(--accent, #2383e2)" : "rgba(255,255,255,.28)"
            }`,
            color: "#fff",
            minWidth: ctx.placed ? "0" : "min(5.25rem, 100%)",
            minHeight: "1.55em",
            overflowWrap: "anywhere",
          }}
          aria-label={ctx.placed ? `Filled with ${ctx.placed}. Click to clear.` : "Drop zone"}
        >
          {ctx.placed ?? "\u00a0"}
        </button>,
      );
    }
  });
  return <>{nodes}</>;
}
