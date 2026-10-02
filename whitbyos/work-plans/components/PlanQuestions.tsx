"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { answerPlanQuestions, holdPlanQuestions } from "@/whitbyos/work-plans/actions";
import type { DraftedQuestion } from "@/whitbyos/lib/ai/draft-questions";

/**
 * What Whitby wants to know before it drafts.
 *
 * All of them on one screen rather than one at a time. A professional reads
 * four questions in the time it takes to load the second of four pages, and
 * reading them together is how you notice that the third one has already
 * been answered by what you typed into the first.
 *
 * Nothing here is required. The plan is what was asked for; these are an
 * improvement on the way to it, and an improvement that can refuse to let
 * you past is a toll gate. A blank becomes a `missing_info` consideration on
 * the plan, so what is skipped is moved rather than lost, and the screen
 * says so before anybody skips.
 */
export function PlanQuestions({
  planId,
  planName,
  clientName,
  questions,
  saved,
}: {
  planId: string;
  planName: string;
  clientName: string | null;
  questions: DraftedQuestion[];
  /** Answers typed on an earlier visit and left for later. */
  saved: { question: string; answer: string }[];
}) {
  /* Seeded from what was kept, so coming back is a pause rather than a way
     of losing three sentences somebody had already worked out. */
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const held = new Map(saved.map((row) => [row.question, row.answer]));
    const seed: Record<number, string> = {};
    questions.forEach((row, index) => {
      const answer = held.get(row.question);
      if (answer) seed[index] = answer;
    });
    return seed;
  });
  const filled = Object.values(answers).filter((value) => value.trim()).length;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <div className="mx-auto w-full max-w-[720px]">
        {/*
          * The header runs to the same width as the cards below it.
          *
          * It was capped at 62ch, which is a good measure for a page of prose
          * and the wrong one here: the cards are 720px, so the paragraph
          * stopped a hundred pixels short of them and the whole block read as
          * slightly out of true. A column is a column.
          *
          * The sentences are the other half. Three of them ran together, and
          * the third said "nothing is required, and nothing is lost either
          * way" directly above two buttons and a line that say exactly that
          * in more useful words. Said once, where it is acted on.
          */}
        <header className="mb-7 border-b pb-5" style={{ borderColor: "var(--chrome-line)" }}>
          <div
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--accent)" }}
          >
            Before Whitby drafts
          </div>
          <h1 className="text-[25px] font-bold leading-tight tracking-[-0.3px]">
            {questions.length === 1
              ? "One thing first"
              : `${questions.length} things first`}
          </h1>
          <p
            className="mt-2.5 text-[14px] leading-[1.6]"
            style={{ marginBottom: 0, color: "var(--text-secondary)" }}
          >
            These are the answers Whitby would otherwise have to guess at
            {clientName ? ` on ${clientName}'s work` : ""}. Every date and every
            dependency below is worked out from them, so a guess here is wrong all
            the way down.
          </p>
        </header>

        <form action={answerPlanQuestions} className="flex flex-col gap-3">
          <input type="hidden" name="plan_id" value={planId} />

          {questions.map((row, index) => (
            <section
              key={index}
              /* `cursor-default` because everything in here but the field is
                 something to read. An I-beam over a heading says you can
                 type in it, on a screen where four boxes say where you can. */
              className="cursor-default rounded-[12px] border px-4 py-4"
              style={{
                borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                background: "var(--surface)",
                boxShadow: "0 1px 2px rgba(31,72,125,.04)",
              }}
            >
              <div className="flex items-start gap-3">
                {/* Four questions on one screen need somewhere to be in.
                    Without the count, scrolling past the third feels like
                    a form that keeps going. */}
                <span
                  aria-hidden
                  className="mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
              <label
                htmlFor={`answer_${index}`}
                className="block cursor-text text-[14px] font-semibold leading-snug"
              >
                {row.question}
              </label>

              {/* Why the plan needs it. The only thing on this screen that
                  says what the interruption buys, which is what separates a
                  clarifying question from a form field. */}
              {row.why ? (
                <p className="mt-1 text-[12.5px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
                  {row.why}
                </p>
              ) : null}

              {/* Offered answers, where the answer is a choice. They fill the
                  field rather than replacing it: the right answer is often
                  one of these with a word added. */}
              {row.options && row.options.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {row.options.map((option) => {
                    const on = (answers[index] ?? "").trim() === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setAnswers((at) => ({ ...at, [index]: on ? "" : option }))
                        }
                        aria-pressed={on}
                        className="rounded-full border px-2.5 py-[5px] text-[12.5px] font-medium transition-colors"
                        style={
                          on
                            ? {
                                borderColor: "var(--accent)",
                                background: "var(--accent-tint)",
                                color: "var(--accent)",
                              }
                            : {
                                borderColor: "var(--border-strong)",
                                background: "var(--surface)",
                                color: "var(--text-secondary)",
                              }
                        }
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/*
                * No drag handle.
                *
                * `resize-y` draws a grip in the corner, and on an empty
                * textarea the browser paints it as a bar down the right
                * edge — which on a page of four identical fields reads as a
                * caret sitting in a box nobody clicked. It also invites
                * somebody to drag a box on a page whose whole point is that
                * the answers are short. The field grows itself instead.
                */}
              <textarea
                id={`answer_${index}`}
                name={`answer_${index}`}
                value={answers[index] ?? ""}
                onChange={(event) => {
                  setAnswers((at) => ({ ...at, [index]: event.target.value }));
                  grow(event.target);
                }}
                rows={2}
                /*
                  * No example answer.
                  *
                  * The model used to write one into the placeholder, and
                  * they read as real: "Manchester", "Two adults, one
                  * child, Indian" — on a plan for a Pakistani family
                  * moving to Richmond. A plausible wrong answer sitting in
                  * an empty box, on the one screen in the product whose
                  * whole purpose is to stop guessing.
                  */
                placeholder={
                  row.options && row.options.length > 0
                    ? "Or type your own"
                    : "Type your answer"
                }
                className="mt-2.5 w-full resize-none overflow-hidden rounded-control border px-3 py-2 text-[13.5px] leading-[1.55] outline-none transition-colors focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_16%,transparent)]"
                style={{
                  borderColor: "var(--border-strong)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                }}
              />
                </div>
              </div>
            </section>
          ))}

          <Footer planName={planName} asked={questions.length} filled={filled} />
        </form>
      </div>
    </div>
  );
}

/**
 * A field that is as tall as what is in it.
 *
 * Two rows to begin with, because two is what most of these answers take
 * and an empty box the size of a paragraph asks for one. It grows from
 * there rather than scrolling inside itself, so a longer answer is read
 * back whole before it is sent.
 */
function grow(field: HTMLTextAreaElement) {
  field.style.height = "auto";
  field.style.height = `${field.scrollHeight}px`;
}

/**
 * One button, and a sentence saying what it will do.
 *
 * There were two: "Skip for now" and "Draft the plan". With nothing filled
 * in they did exactly the same thing, so the screen offered a choice it
 * could not honour — and with something filled in, "Skip for now" was worse
 * than useless, because it posts the same form and would have sent the
 * answers it promised to skip.
 *
 * So the button says what pressing it does from here, and the line beside it
 * says what happens to whatever is still blank. Nothing is required, which
 * was the point; a second button was never what made that true.
 *
 * Separated from the form so `useFormStatus` can be read: it only reports
 * for a form above it in the tree.
 */
function Footer({
  planName,
  asked,
  filled,
}: {
  planName: string;
  asked: number;
  filled: number;
}) {
  const { pending } = useFormStatus();
  const skipped = asked - filled;

  return (
    /* At the end of the questions, where the reading stops. A bar that
       follows you down the page is a bar in front of the last question
       while you are answering it. */
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-[46ch] text-[12.5px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
        {pending
          ? `Building ${planName}…`
          : skipped === 0
            ? "All answered. Whitby will build the plan from these."
            : skipped === asked
              ? "Build it now and every blank is raised on the plan as something to confirm. Save and come back, and no plan is written until you do."
              : `Build it now and ${skipped === 1 ? "the one left blank is" : `the ${skipped} left blank are`} raised on the plan as something to confirm. Save and come back, and no plan is written until you do.`}
      </p>

      <div className="flex shrink-0 items-center gap-2.5">
        {/*
          * Two buttons, two outcomes.
          *
          * This one does not draft. The plan waits where it is with its
          * questions still against it, whatever has been typed is kept for
          * the way back, and somebody goes and finds out the thing they did
          * not know. That is what "for now" meant on the label this
          * replaces, and it is the only thing that makes a second button
          * honest: without it, both pressed the same lever.
          */}
        <SubmitPlain
          formAction={holdPlanQuestions}
          className="rounded-control border px-3.5 py-[9px] text-[13.5px] font-medium"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border-strong)",
            color: "var(--text-secondary)",
          }}
        >
          {/*
            * It says what it does, because "Skip" did not.
            *
            * Read as skipping the questions and carrying on, which is what
            * the word means everywhere else, so pressing it and finding no
            * plan at the end of it was a surprise every time. This one
            * cannot be misread: nothing is built, and what is typed is kept.
            */}
          Save and come back
        </SubmitPlain>

        {/*
          * Blue only once there is something to build from.
          *
          * With every box empty, building means building on guesses, and the
          * screen was putting its loudest button on exactly that. It stays
          * pressable, because answering is optional and a screen that can
          * refuse to let you past is a toll gate; it just stops being the
          * recommendation until one answer exists.
          */}
        <Submit
          unsized
          variant={filled > 0 ? "primary" : "secondary"}
          className="px-[18px] py-[9px] text-[13.5px]"
        >
          {/* "Draft" is what the model does; "build" is what the person
              asked for, and it is the word the step they came from uses —
              "Build with Whitby", "Generate Work Plan". */}
          {/* One question answered is "this answer", not "these answers".
              The plural was written for the four-question case and read as a
              mistake on the one-question screen, which is most of them. */}
          {filled === 0
            ? "Build the plan"
            : skipped === 0
              ? filled === 1
                ? "Build with this answer"
                : "Build with these answers"
              : `Build with ${filled} ${filled === 1 ? "answer" : "answers"}`}
        </Submit>
      </div>
    </div>
  );
}
