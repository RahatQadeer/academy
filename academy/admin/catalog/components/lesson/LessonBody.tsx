"use client";

import { useMemo, useState } from "react";
import type { CatalogAssignment, CatalogLesson, CatalogLessonResource } from "../../types";
import { formatInlineMarkdown, formatInlineMarkdownFragment } from "../../lib/formatInlineMarkdown";
import {
  cleanDisplayLine,
  looksLikeCalloutLabel,
  sanitizeLessonMarkdown,
  stripWrappingBrackets,
  unwrapCalloutSource,
} from "../../lib/lessonContentText";
import { formatMinutes } from "../../lib/programStats";
import type { LessonExercise } from "@/academy/lib/lessonExercise";
import { parseExerciseFence } from "@/academy/lib/lessonExercise";
import {
  emphasizeStructuralLabels,
  isDefinitionLeadLine,
  isExampleLeadLine,
  isSummaryLeadLine,
  looksLikeQuestionHeading,
  splitDefinitionTermAndMeaning,
  tryInferDefinitionParagraph,
  tryInferScenarioParagraph,
  tryParseDefinitionParagraph,
  tryParseExampleParagraph,
  tryParseQuestionLead,
  tryParseScenarioParagraph,
  tryParseSummaryParagraph,
  type ParsedScenario,
} from "@/academy/lib/lessonContentDesign";
import { ExerciseBlock } from "./ExerciseBlock";
import { LessonMediaFrame } from "./LessonMediaFrame";
import {
  briefHasBankPrompt,
  splitBankBriefBlocks,
  stripBankBriefMarkers,
} from "@/academy/lib/questionBank/bankOrigin";

export function splitQuestion(text: string) {
  const cleaned = text.trim();
  const [question, ...rest] = cleaned.split(/\n\nExplanation:\s*/i);
  return { question: question.trim(), explanation: rest.join("\n\n").trim() };
}

export function LessonBody({
  lesson,
  hideAssignment = false,
  showBankStars = false,
}: {
  lesson: CatalogLesson;
  hideAssignment?: boolean;
  /** Authoring-only: mark assignment prompts added from the question bank. */
  showBankStars?: boolean;
}) {
  const objectives = useMemo(
    () =>
      lesson.learningObjectives
        .map((objective) => cleanDisplayLine(objective))
        .filter((objective): objective is string => Boolean(objective)),
    [lesson.learningObjectives],
  );
  const blocks = useMemo(() => parseLessonBody(lesson.contentBody), [lesson.contentBody]);
  const resources = usableResources(lesson.resources);
  const assignment = assignmentHasContent(lesson.assignment) ? lesson.assignment : null;

  return (
    <article className="min-w-0 max-w-full space-y-7 overflow-x-hidden">
      {objectives.length > 0 ? (
        <div
          className="rounded-[10px] px-4 py-4 sm:px-5"
          style={{
            background: "var(--module-academy-bg)",
            borderLeft: "3px solid var(--module-academy-fg)",
            boxShadow: "0 1px 2px rgba(15,15,15,.03)",
          }}
        >
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--module-academy-fg)" }}
          >
            By the end of this lesson
          </p>
          <ul className="mt-2.5 space-y-1.5 pl-0">
            {objectives.map((objective) => (
              <li
                key={objective}
                className="flex gap-2.5 text-[14.5px] leading-[1.6] text-justify"
                style={{ color: "var(--ink)" }}
              >
                <span
                  className="mt-[0.55em] size-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--module-academy-fg)" }}
                />
                <span className="min-w-0 flex-1">{formatInlineMarkdownFragment(objective)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-6">
        {blocks.map((block, index) => (
          <BodyBlock key={`${index}-${block.kind}`} block={block} />
        ))}
      </div>

      {resources.length > 0 ? <ResourceCards resources={resources} /> : null}
      {assignment && !hideAssignment ? (
        <AssignmentCard assignment={assignment} showBankStars={showBankStars} />
      ) : null}
    </article>
  );
}

/** Render Whitby / rubric markdown with the same polish as lesson bodies (tables, headings, bold). */
export function LessonMarkdownBody({
  content,
  className,
  compact = false,
}: {
  content: string;
  className?: string;
  /** Chat / sidebar density — keeps lesson polish without lesson-scale type. */
  compact?: boolean;
}) {
  const blocks = useMemo(() => parseLessonBody(content), [content]);
  if (!content.trim()) return null;
  if (!blocks.length) {
    return (
      <p
        className={`whitespace-pre-wrap leading-[1.55] ${compact ? "text-[13px]" : "text-[14px] leading-[1.65]"}`}
        style={{ color: "var(--ink)" }}
      >
        {content}
      </p>
    );
  }
  return (
    <div className={`${className ?? (compact ? "space-y-2.5" : "space-y-4")} min-w-0 max-w-full overflow-x-hidden`}>
      {blocks.map((block, index) => (
        <BodyBlock key={`${index}-${block.kind}`} block={block} compact={compact} />
      ))}
    </div>
  );
}

type CalloutVariant = "info" | "note" | "important" | "warning" | "tip";

type BodyBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "image"; src: string; alt: string; caption?: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "callout"; variant: CalloutVariant; title: string; text: string }
  | { kind: "example"; title: string; body: string }
  | { kind: "worked_example"; title: string; body: string }
  | { kind: "summary"; title: string; body: string }
  | { kind: "definition"; term: string; meaning: string }
  | { kind: "question"; question: string; answer: string }
  | { kind: "takeaways"; items: string[] }
  | { kind: "code"; language: string; code: string }
  | { kind: "exercise"; exercise: LessonExercise };

const CALLOUT_STYLES: Record<
  CalloutVariant,
  { border: string; bg: string; label: string; accent: string }
> = {
  info: {
    border: "rgba(35,131,226,.35)",
    bg: "var(--accent-tint-mid, #f4f9fe)",
    label: "var(--accent, #2383e2)",
    accent: "var(--accent, #2383e2)",
  },
  note: {
    border: "rgba(24,51,71,.22)",
    bg: "var(--info-bg, #d3e5ef)",
    label: "var(--info-fg, #183347)",
    accent: "var(--info-fg, #183347)",
  },
  important: {
    border: "rgba(35,131,226,.45)",
    bg: "var(--accent-tint, #e7f1fb)",
    label: "var(--accent, #2383e2)",
    accent: "var(--accent, #2383e2)",
  },
  warning: {
    border: "var(--warning-border, #f2e2ca)",
    bg: "var(--warning-bg, #fdf7ee)",
    label: "var(--warning-fg, #7a5a2e)",
    accent: "var(--warning-fg, #7a5a2e)",
  },
  tip: {
    border: "rgba(28,122,82,.28)",
    bg: "var(--success-bg, #d6ecd8)",
    label: "var(--success-fg, #1c7a52)",
    accent: "var(--success-fg, #1c7a52)",
  },
};

function LessonImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  const label = caption?.trim() || alt.trim();
  return (
    <LessonMediaFrame kind="image" caption={label || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ""}
        className="mx-auto block h-auto max-h-[560px] w-full rounded-[8px] object-contain"
        style={{ background: "var(--surface)" }}
      />
    </LessonMediaFrame>
  );
}

function BodyBlock({ block, compact = false }: { block: BodyBlock; compact?: boolean }) {
  const body = compact ? "text-[13px] leading-[1.55]" : "text-[15.5px] leading-[1.8]";
  const listBody = compact ? "text-[13px] leading-[1.55]" : "text-[15.5px] leading-[1.75]";
  const calloutBody = compact ? "text-[12.5px] leading-[1.55]" : "text-[14.5px] leading-[1.7]";
  const takeawayBody = compact ? "text-[12.5px] leading-[1.55]" : "text-[14.5px] leading-[1.65]";

  if (block.kind === "image") {
    return <LessonImage src={block.src} alt={block.alt} caption={block.caption} />;
  }
  if (block.kind === "code") {
    return <CodeBlock language={block.language} code={block.code} />;
  }
  if (block.kind === "exercise") {
    return (
      <div className="min-w-0 max-w-full">
        <ExerciseBlock exercise={block.exercise} />
      </div>
    );
  }
  if (block.kind === "heading") {
    if (block.level === 3) {
      return (
        <h4
          className={
            compact
              ? "pt-0.5 text-[13.5px] font-semibold tracking-[-0.01em]"
              : "pt-2 text-[16px] font-bold tracking-[-0.01em]"
          }
          style={{ color: "var(--ink)" }}
        >
          {formatInlineMarkdownFragment(block.text)}
        </h4>
      );
    }
    return (
      <h3
        className={
          compact
            ? "border-b pb-1 pt-1 text-[14px] font-semibold tracking-[-0.01em]"
            : "border-b pb-2 pt-3 text-[18px] font-bold tracking-[-0.02em]"
        }
        style={{ color: "var(--ink)", borderColor: "var(--border)" }}
      >
        {formatInlineMarkdownFragment(block.text)}
      </h3>
    );
  }
  if (block.kind === "paragraph") {
    const scenario = tryParseScenarioParagraph(block.text);
    if (scenario) return <ScenarioCard scenario={scenario} compact={compact} />;
    const definition = tryParseDefinitionParagraph(block.text);
    if (definition) {
      return <DefinitionCard term={definition.term} meaning={definition.meaning} compact={compact} />;
    }
    const question = tryParseQuestionLead(block.text);
    if (question) {
      return <QuestionBlock question={question.question} answer={question.answer} compact={compact} />;
    }
    return (
      <p className={`${body} text-pretty`} style={{ color: "var(--ink)" }}>
        {formatInlineMarkdown(emphasizeStructuralLabels(block.text))}
      </p>
    );
  }
  if (block.kind === "list") {
    return (
      <ul className={compact ? "space-y-1.5" : "space-y-2.5"}>
        {block.items.map((item, index) => (
          <li key={`${index}-${item}`} className={`flex gap-3 ${listBody} text-justify`} style={{ color: "var(--ink)" }}>
            {block.ordered ? (
              <span
                className={`mt-px w-5 shrink-0 font-medium tabular-nums ${compact ? "text-[12px]" : "text-[13.5px]"}`}
                style={{ color: "var(--text-tertiary)" }}
              >
                {index + 1}.
              </span>
            ) : (
              <span
                className="mt-[0.7em] size-1.5 shrink-0 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            )}
            <span className="min-w-0 flex-1">{formatInlineMarkdown(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "table") {
    return <LessonTable headers={block.headers} rows={block.rows} />;
  }
  if (block.kind === "callout") {
    const style = CALLOUT_STYLES[block.variant];
    return (
      <aside
        className="overflow-hidden rounded-[10px] border"
        style={{ borderColor: style.border, background: style.bg }}
      >
        <div
          className={`border-b ${compact ? "px-3 py-1.5" : "px-4 py-2"}`}
          style={{ borderColor: style.border, background: "rgba(255,255,255,.35)" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: style.label }}
          >
            {block.title}
          </p>
        </div>
        <p className={`${compact ? "px-3 py-2.5" : "px-4 py-3.5"} ${calloutBody} text-pretty`} style={{ color: "var(--ink)" }}>
          {formatInlineMarkdown(stripWrappingBrackets(block.text))}
        </p>
      </aside>
    );
  }
  if (block.kind === "example") {
    const fromBody =
      tryParseScenarioParagraph(`Scenario: ${block.body}`) ||
      tryParseScenarioParagraph(`Scenario — ${block.title}\n${block.body}`);
    return (
      <ScenarioCard
        compact={compact}
        scenario={
          fromBody ?? {
            title: block.title || "Applied scenario",
            situation: block.body,
            decision: "",
            answer: "",
          }
        }
      />
    );
  }
  if (block.kind === "worked_example") {
    return <ExampleCard title={block.title} body={block.body} compact={compact} />;
  }
  if (block.kind === "summary") {
    return <SummaryCard title={block.title} body={block.body} compact={compact} />;
  }
  if (block.kind === "definition") {
    return <DefinitionCard term={block.term} meaning={block.meaning} compact={compact} />;
  }
  if (block.kind === "question") {
    return <QuestionBlock question={block.question} answer={block.answer} compact={compact} />;
  }
  if (block.kind === "takeaways") {
    if (block.items.length === 0) return null;
    return (
      <section
        className="overflow-hidden rounded-[10px] border-2"
        style={{ borderColor: "rgba(28,122,82,.25)", background: "var(--success-bg, #d6ecd8)" }}
      >
        <div
          className={`border-b ${compact ? "px-3 py-2" : "px-4 py-2.5"}`}
          style={{ borderColor: "rgba(28,122,82,.2)", background: "rgba(255,255,255,.4)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--success-fg, #1c7a52)" }}>
            Key takeaways
          </p>
        </div>
        <ul className={`space-y-2 ${compact ? "px-3 py-2.5" : "px-4 py-3.5"}`}>
          {block.items.map((item) => (
            <li key={item} className={`flex gap-3 ${takeawayBody} text-justify`} style={{ color: "var(--ink)" }}>
              <span
                className="mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(28,122,82,.18)", color: "var(--success-fg, #1c7a52)" }}
                aria-hidden
              >
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3.5 8.2 6.6 11.2 12.5 4.8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {formatInlineMarkdownFragment(item)}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return null;
}

function ScenarioCard({ scenario, compact = false }: { scenario: ParsedScenario; compact?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const { title, situation, decision, answer } = scenario;
  const showTitle = title.trim() && title.trim().toLowerCase() !== "applied scenario";
  if (!situation && !decision && !answer && !showTitle) return null;

  return (
    <section
      className="overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "rgba(35,131,226,.28)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 10px 28px rgba(35,131,226,.06)",
      }}
    >
      <div
        className={`flex items-center gap-3 border-b ${compact ? "px-3 py-2" : "px-4 py-3 sm:px-5"}`}
        style={{
          borderColor: "rgba(35,131,226,.16)",
          background: "linear-gradient(90deg, var(--accent-tint, #e7f1fb) 0%, var(--surface) 72%)",
        }}
      >
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded-[8px] ${compact ? "size-7" : "size-8"}`}
          style={{ background: "rgba(35,131,226,.12)", color: "var(--accent, #2383e2)" }}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 3.5h10v9H3z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M5.5 6.5h5M5.5 9h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--accent, #2383e2)" }}
          >
            Scenario
          </p>
          {showTitle ? (
            <p
              className={`mt-0.5 font-bold tracking-[-0.015em] ${compact ? "text-[13px]" : "text-[15px]"}`}
              style={{ color: "var(--ink)" }}
            >
              {formatInlineMarkdownFragment(title)}
            </p>
          ) : null}
        </div>
      </div>

      <div className={`space-y-3 ${compact ? "px-3 py-3" : "space-y-4 px-4 py-4 sm:px-5 sm:py-5"}`}>
        {situation ? (
          <p className={compact ? "text-[13px] leading-[1.55]" : "text-[15px] leading-[1.75]"} style={{ color: "var(--ink)" }}>
            {formatInlineMarkdown(situation)}
          </p>
        ) : null}

        {decision ? (
          <div
            className={`rounded-[10px] border ${compact ? "px-3 py-2.5" : "px-3.5 py-3"}`}
            style={{
              borderColor: "rgba(35,131,226,.2)",
              background: "var(--accent-tint-mid, #f4f9fe)",
            }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: "var(--accent, #2383e2)" }}
            >
              Decision
            </p>
            <p
              className={`mt-1.5 font-semibold ${compact ? "text-[12.5px] leading-[1.5]" : "text-[14.5px] leading-[1.65]"}`}
              style={{ color: "var(--ink)" }}
            >
              {formatInlineMarkdown(decision)}
            </p>
          </div>
        ) : null}

        {answer ? (
          <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="rounded-[8px] px-3.5 py-2 text-[13px] font-semibold"
                style={{
                  background: "var(--accent, #2383e2)",
                  color: "#fff",
                }}
              >
                Show recommended approach
              </button>
            ) : (
              <div
                className={`rounded-[10px] border ${compact ? "px-3 py-2.5" : "px-3.5 py-3"}`}
                style={{
                  borderColor: "rgba(28,122,82,.25)",
                  background: "var(--success-bg, #d6ecd8)",
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: "var(--success-fg, #1c7a52)" }}
                >
                  Recommended approach
                </p>
                <p
                  className={`mt-1.5 ${compact ? "text-[12.5px] leading-[1.5]" : "text-[14.5px] leading-[1.65]"}`}
                  style={{ color: "var(--ink)" }}
                >
                  {formatInlineMarkdown(answer)}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DefinitionCard({
  term,
  meaning,
  compact = false,
}: {
  term: string;
  meaning: string;
  compact?: boolean;
}) {
  let title = term.trim();
  let body = meaning.trim();

  const repaired =
    splitDefinitionTermAndMeaning(`${title}\n${body}`) ||
    splitDefinitionTermAndMeaning(title) ||
    (body ? splitDefinitionTermAndMeaning(body) : null);

  if (repaired) {
    title = repaired.term;
    body = repaired.meaning;
  }

  if (title && body) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const stripped = body
      .replace(new RegExp(`^\\*{0,2}${escaped}\\*{0,2}\\s*[:—–-]?\\s*`, "i"), "")
      .trim();
    if (stripped) body = stripped;
  }

  const titleNorm = title.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const bodyNorm = body.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

  // Same blob twice → keep one explanation, invent a short name from the lead phrase.
  if (title && body && titleNorm === bodyNorm) {
    const lead =
      title.match(/^((?:[A-Z][\w'/&-]*)(?:\s+[a-z][\w'/&-]*){0,5})/)?.[1]?.trim() ||
      title.split(/\s+/).slice(0, 4).join(" ");
    if (lead && lead.toLowerCase() !== titleNorm) {
      title = lead;
      body = meaning.trim() || term.trim();
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      body = body
        .replace(new RegExp(`^\\*{0,2}${escaped}\\*{0,2}\\s*[:—–-]?\\s*`, "i"), "")
        .trim() || body;
    }
  }

  if (!title) title = "Untitled term";
  // Always keep a body when we have definition text — never drop the card content.
  if (!body) body = meaning.trim() || term.trim();
  if (body.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase() === titleNorm) {
    // Last resort: show full text as body under a short title.
    body = meaning.trim() || term.trim();
  }

  return (
    <aside
      className="overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "rgba(35,131,226,.28)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 10px 28px rgba(35,131,226,.06)",
      }}
    >
      <div
        className={`flex items-center gap-3 border-b ${compact ? "px-3 py-2" : "px-4 py-3 sm:px-5"}`}
        style={{
          borderColor: "rgba(35,131,226,.16)",
          background: "linear-gradient(90deg, var(--accent-tint, #e7f1fb) 0%, var(--surface) 72%)",
        }}
      >
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded-[8px] ${compact ? "size-7" : "size-8"}`}
          style={{ background: "rgba(35,131,226,.12)", color: "var(--accent, #2383e2)" }}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M5 2.5h6v11H5z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M7 5.5h2M7 8h2M7 10.5h1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--accent, #2383e2)" }}
          >
            Definition
          </p>
          <p
            className={`mt-0.5 font-bold tracking-[-0.015em] ${compact ? "text-[13px]" : "text-[15px]"}`}
            style={{ color: "var(--ink)" }}
          >
            {formatInlineMarkdownFragment(title)}
          </p>
        </div>
      </div>

      <div className={compact ? "px-3 py-3" : "px-4 py-4 sm:px-5 sm:py-4"}>
        <p
          className={compact ? "text-[13px] leading-[1.55]" : "text-[14.5px] leading-[1.7]"}
          style={{ color: "var(--text-secondary)" }}
        >
          {formatInlineMarkdown(body)}
        </p>
      </div>
    </aside>
  );
}

function ExampleCard({
  title,
  body,
  compact = false,
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <aside
      className="overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "rgba(28,122,82,.28)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 10px 28px rgba(28,122,82,.06)",
      }}
    >
      <div
        className={`border-b ${compact ? "px-3 py-2" : "px-4 py-3"}`}
        style={{
          borderColor: "rgba(28,122,82,.16)",
          background: "linear-gradient(90deg, var(--success-bg, #d6ecd8) 0%, var(--surface) 72%)",
        }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "var(--success-fg, #1c7a52)" }}
        >
          Example
        </p>
        {title.trim() ? (
          <p
            className={`mt-0.5 font-semibold ${compact ? "text-[13px]" : "text-[14.5px]"}`}
            style={{ color: "var(--ink)" }}
          >
            {formatInlineMarkdownFragment(title)}
          </p>
        ) : null}
      </div>
      <div className={compact ? "px-3 py-3" : "px-4 py-4"}>
        <p
          className={`text-pretty ${compact ? "text-[13px] leading-[1.55]" : "text-[14.5px] leading-[1.7]"}`}
          style={{ color: "var(--ink)" }}
        >
          {formatInlineMarkdown(body)}
        </p>
      </div>
    </aside>
  );
}

function SummaryCard({
  title,
  body,
  compact = false,
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  const items = body
    .split("\n")
    .map((line) => line.replace(/^([•\-]|[\d]+\.)\s*/, "").trim())
    .filter(Boolean);

  return (
    <aside
      className="overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "rgba(24,51,71,.2)",
        background: "var(--surface-soft)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04)",
      }}
    >
      <div className={`border-b ${compact ? "px-3 py-2" : "px-4 py-2.5"}`} style={{ borderColor: "var(--border)" }}>
        <p
          className="text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Summary
        </p>
        {title.trim() && !/^summary$/i.test(title.trim()) ? (
          <p className={`mt-0.5 font-semibold ${compact ? "text-[13px]" : "text-[14px]"}`} style={{ color: "var(--ink)" }}>
            {formatInlineMarkdownFragment(title)}
          </p>
        ) : null}
      </div>
      <ul className={`space-y-2 ${compact ? "px-3 py-2.5" : "px-4 py-3.5"}`}>
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[14px] leading-[1.55]" style={{ color: "var(--ink)" }}>
            <span
              className="mt-[0.55em] size-1.5 shrink-0 rounded-full"
              style={{ background: "var(--accent, #2383e2)" }}
            />
            <span className="min-w-0 flex-1">{formatInlineMarkdown(item)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function QuestionBlock({
  question,
  answer,
  compact = false,
}: {
  question: string;
  answer: string;
  compact?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const hasAnswer = Boolean(answer.trim());

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      <p
        className={
          compact
            ? "text-[13.5px] font-semibold leading-[1.45] tracking-[-0.01em]"
            : "text-[17px] font-bold leading-[1.45] tracking-[-0.02em]"
        }
        style={{ color: "var(--ink)" }}
      >
        {formatInlineMarkdownFragment(question)}
      </p>
      {hasAnswer && !revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
        >
          Show answer
        </button>
      ) : null}
      {hasAnswer && revealed ? (
        <p
          className={`text-pretty ${compact ? "text-[13px] leading-[1.55]" : "text-[15.5px] leading-[1.8]"}`}
          style={{ color: "var(--ink)" }}
        >
          {formatInlineMarkdown(emphasizeStructuralLabels(answer))}
        </p>
      ) : null}
    </div>
  );
}

function LessonTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const colCount = Math.max(headers.length, ...rows.map((row) => row.length), 1);

  return (
    <div
      className="overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.03)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Table
        </p>
        <p className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {rows.length} row{rows.length === 1 ? "" : "s"}
          {headers.length > 0 ? ` · ${headers.length} col${headers.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-[14px] leading-[1.55]">
          {headers.length > 0 ? (
            <thead>
              <tr>
                {Array.from({ length: colCount }, (_, index) => (
                  <th
                    key={`h-${index}`}
                    className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold tracking-[-0.01em]"
                    style={{
                      color: "var(--ink)",
                      background: "var(--surface-soft)",
                      borderBottom: "1px solid var(--border-strong)",
                    }}
                  >
                    {headers[index] ? formatInlineMarkdown(headers[index]) : ""}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{
                  background: rowIndex % 2 === 0 ? "var(--surface)" : "var(--surface-subtle)",
                }}
              >
                {Array.from({ length: colCount }, (_, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="px-4 py-3 align-top"
                    style={{
                      color: "var(--ink)",
                      borderTop: headers.length === 0 && rowIndex === 0 ? undefined : "1px solid var(--border)",
                    }}
                  >
                    {row[cellIndex] ? formatInlineMarkdown(row[cellIndex]) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const lines = code.replace(/\n$/, "").split("\n");
  const label = languageLabel(language);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <figure
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "#1e1e1e",
        boxShadow: "0 1px 2px rgba(15,15,15,.08), 0 12px 28px rgba(15,15,15,.12)",
      }}
    >
      <figcaption
        className="flex items-center gap-3 border-b px-3.5 py-2.5"
        style={{ borderColor: "rgba(255,255,255,.08)", background: "#252526" }}
      >
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full" style={{ background: "#ff5f56" }} />
          <span className="size-2.5 rounded-full" style={{ background: "#ffbd2e" }} />
          <span className="size-2.5 rounded-full" style={{ background: "#27c93f" }} />
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-[12px]"
          style={{ color: "rgba(255,255,255,.55)" }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="shrink-0 cursor-pointer rounded-[6px] border-none px-2 py-1 font-mono text-[11px] font-medium transition-colors"
          style={{
            background: copied ? "rgba(39,201,63,.16)" : "rgba(255,255,255,.06)",
            color: copied ? "#89d185" : "rgba(255,255,255,.72)",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>

      <pre className="m-0 overflow-x-auto py-3" style={{ background: "#1e1e1e" }}>
        <code className="block font-mono text-[12.5px] leading-[1.7]">
          {lines.map((line, index) => (
            <span key={index} className="flex min-w-full">
              <span
                className="w-10 shrink-0 select-none pr-3 text-right tabular-nums"
                style={{ color: "rgba(255,255,255,.28)" }}
                aria-hidden
              >
                {index + 1}
              </span>
              <span
                className="min-w-0 flex-1 whitespace-pre pr-4"
                style={{ color: "#d4d4d4" }}
                dangerouslySetInnerHTML={{ __html: highlightCodeLine(line, language) }}
              />
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

function languageLabel(language: string) {
  const raw = language.trim();
  if (!raw) return "code";
  const map: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "javascriptreact",
    tsx: "typescriptreact",
    py: "python",
    rb: "ruby",
    sh: "shell",
    bash: "shell",
    yml: "yaml",
    md: "markdown",
  };
  return map[raw.toLowerCase()] ?? raw.toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Lightweight VS Code–like highlighting for lesson code fences. */
function highlightCodeLine(line: string, language: string) {
  const lang = language.toLowerCase();
  const escaped = escapeHtml(line);

  if (/^\s*(\/\/|#|--)/.test(line)) {
    return `<span style="color:#6a9955">${escaped}</span>`;
  }

  if (/^\s*(\/\*|\*)/.test(line) || line.includes("*/")) {
    return `<span style="color:#6a9955">${escaped}</span>`;
  }

  let html = escaped;

  html = html.replace(
    /(&quot;|'|`)(?:\\.|(?!\1).)*?\1/g,
    (match) => `<span style="color:#ce9178">${match}</span>`,
  );

  html = html.replace(
    /\b(0x[\da-fA-F]+|\d+\.\d+|\d+)\b/g,
    `<span style="color:#b5cea8">$1</span>`,
  );

  const keywords =
    lang.includes("py") || lang === "python"
      ? /\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|raise|True|False|None|and|or|not|in|is|lambda|yield|async|await|pass|break|continue)\b/g
      : lang.includes("sql")
        ? /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|ASC|DESC|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|AND|OR|NOT|AS|LIMIT|OFFSET|NULL|TRUE|FALSE)\b/gi
        : /\b(const|let|var|function|return|if|else|for|while|class|extends|new|import|export|from|async|await|try|catch|throw|typeof|instanceof|switch|case|break|continue|default|null|undefined|true|false|this|of|in|interface|type|enum|public|private|protected|static|void|string|number|boolean)\b/g;

  html = html.replace(keywords, `<span style="color:#569cd6">$1</span>`);

  html = html.replace(
    /\b([A-Za-z_][\w]*)\s*(?=\()/g,
    `<span style="color:#dcdcaa">$1</span>`,
  );

  return html || "&nbsp;";
}

function usableResources(resources: CatalogLessonResource[]) {
  return resources.filter((resource) => resource.url.trim());
}

function assignmentHasContent(assignment: CatalogAssignment | null | undefined) {
  if (!assignment) return false;
  return Boolean(
    assignment.brief.trim() ||
      assignment.submissionInstructions.trim() ||
      assignment.rubric.trim(),
  );
}

function ResourceCards({ resources }: { resources: CatalogLessonResource[] }) {
  return (
    <section className="space-y-3">
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.09em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Resources
      </p>
      <ul className="space-y-2.5">
        {resources.map((resource) => {
          const image = isImageSrc(resource.url, resource.resourceType);
          return (
            <li
              key={resource.id || resource.title}
              className="rounded-[10px] border px-4 py-3.5"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
                  style={{ background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }}
                  aria-hidden
                >
                  {image ? <ImageGlyph /> : <LinkGlyph />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>
                    {resource.title}
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {resourceLabel(resource.resourceType)}
                  </p>
                  {resource.notes ? (
                    <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {resource.notes}
                    </p>
                  ) : null}
                  {image ? (
                    <div className="mt-3">
                      <LessonImage src={resource.url} alt={resource.title} />
                    </div>
                  ) : resource.url.startsWith("http") ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium no-underline hover:text-accent-hover"
                      style={{ color: "var(--accent)" }}
                    >
                      Open resource
                      <span aria-hidden>↗</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function resourceLabel(type?: string) {
  const value = type?.trim().toLowerCase() ?? "";
  if (value === "pdf") return "PDF";
  if (value === "video") return "Video";
  if (value === "image" || value === "img" || value === "photo" || value === "diagram") return "Image";
  if (value === "link" || value === "url") return "Link";
  return type?.trim() || "Resource";
}

function ImageGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5" cy="6" r="1" fill="currentColor" />
      <path d="M1.8 10.2 5.2 7.4 7.4 9.2 9.1 7.8 12.2 10.4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M6 8.2 8.2 6M5.2 9.4l-.6.6a2.2 2.2 0 1 1-3.1-3.1l.6-.6M8.8 4.6l.6-.6a2.2 2.2 0 1 1 3.1 3.1l-.6.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AssignmentCard({
  assignment,
  showBankStars = false,
}: {
  assignment: CatalogAssignment;
  showBankStars?: boolean;
}) {
  const minutes = Number(assignment.estimatedMinutes);
  const briefBlocks =
    showBankStars && briefHasBankPrompt(assignment.brief)
      ? splitBankBriefBlocks(assignment.brief)
      : null;
  const briefForLearners = stripBankBriefMarkers(assignment.brief);

  return (
    <section className="overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--border-strong)" }}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5"
        style={{ background: "var(--accent-tint-soft, #e7f1fb)" }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--accent, #2383e2)" }}
        >
          Assignment
        </p>
        {Number.isFinite(minutes) && minutes > 0 ? (
          <span className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            {formatMinutes(minutes)}
          </span>
        ) : null}
      </div>
      <div className="space-y-3 px-4 py-4">
        {briefBlocks && briefBlocks.length > 0 ? (
          <div className="space-y-3">
            {briefBlocks.map((block, index) =>
              block.kind === "bank" ? (
                <div
                  key={`bank-${index}`}
                  className="rounded-[8px] border px-3 py-2.5"
                  style={{
                    borderColor: "color-mix(in srgb, #c9a227 28%, var(--border))",
                    background: "color-mix(in srgb, #c9a227 8%, white)",
                  }}
                >
                  <p
                    className="mb-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.05em]"
                    style={{ color: "#8a6d12" }}
                  >
                    <BankStarIcon />
                    From question bank
                  </p>
                  <LessonMarkdownBody content={block.text} className="space-y-2" />
                </div>
              ) : (
                <LessonMarkdownBody key={`text-${index}`} content={block.text} className="space-y-3" />
              ),
            )}
          </div>
        ) : briefForLearners ? (
          <LessonMarkdownBody content={briefForLearners} className="space-y-3" />
        ) : null}
        {assignment.submissionInstructions ? (
          <div>
            <p
              className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              How to submit
            </p>
            <LessonMarkdownBody content={assignment.submissionInstructions} className="space-y-2" />
          </div>
        ) : null}
        {assignment.rubric ? (
          <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <p
              className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Success criteria · instructors only
            </p>
            <LessonMarkdownBody content={assignment.rubric} className="space-y-3" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BankStarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.6l1.76 3.56 3.93.57-2.84 2.77.67 3.91L8 10.56l-3.52 1.85.67-3.91L2.3 5.73l3.93-.57L8 1.6z"
        fill="currentColor"
      />
    </svg>
  );
}

function isImageSrc(url: string, resourceType?: string) {
  if (/^(image|img|diagram|screenshot|photo|figure)$/i.test(resourceType?.trim() ?? "")) {
    return /^https?:\/\//i.test(url.trim());
  }
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url.trim());
}

function parseImageChunk(text: string): Extract<BodyBlock, { kind: "image" }> | null {
  const trimmed = text.trim();
  const markdown = trimmed.match(/^!\[([^\]]*)\]\((https?:[^)\s]+)(?:\s+"([^"]*)")?\)$/i);
  if (markdown) {
    return { kind: "image", src: markdown[2], alt: markdown[1], caption: markdown[3] };
  }

  if (/^<img\b/i.test(trimmed) && />$/.test(trimmed)) {
    const src = trimmed.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const alt = trimmed.match(/\balt=["']([^"']*)["']/i)?.[1] ?? "";
    if (src && /^https?:\/\//i.test(src)) {
      return { kind: "image", src, alt };
    }
  }

  if (/^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s]*)?$/i.test(trimmed)) {
    return { kind: "image", src: trimmed, alt: "" };
  }

  return null;
}

function splitRichText(text: string): BodyBlock[] {
  const pattern = /(!\[[^\]]*\]\(https?:[^)]+\)|<img\b[^>]*>)/gi;
  const parts = text.split(pattern).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const image = parseImageChunk(text);
    return image ? [image] : [{ kind: "paragraph", text: text.trim() }];
  }

  return parts.flatMap((part): BodyBlock[] => {
    const image = parseImageChunk(part);
    return image ? [image] : [{ kind: "paragraph", text: part }];
  });
}

const FENCE_PATTERN = /```([\w-]*)\s*\n?([\s\S]*?)```/g;

const LESSON_PARSE_CACHE = new Map<string, BodyBlock[]>();
const LESSON_PARSE_CACHE_MAX = 48;

function parseLessonBody(body: string): BodyBlock[] {
  const cached = LESSON_PARSE_CACHE.get(body);
  if (cached) return cached;

  const text = sanitizeLessonMarkdown(body);
  if (!text) {
    LESSON_PARSE_CACHE.set(body, []);
    return [];
  }

  const fence = new RegExp(FENCE_PATTERN.source, FENCE_PATTERN.flags);
  const blocks: BodyBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push(...parseTextChunks(text.slice(lastIndex, match.index)));
    }
    const language = match[1]?.trim() || "code";
    const code = match[2].trim();
    if (language.toLowerCase() === "exercise") {
      const exercise = parseExerciseFence(code);
      if (exercise) {
        blocks.push({ kind: "exercise", exercise });
      }
    } else {
      blocks.push({
        kind: "code",
        language,
        code,
      });
    }
    lastIndex = fence.lastIndex;
  }

  if (lastIndex < text.length) {
    blocks.push(...parseTextChunks(text.slice(lastIndex)));
  }

  const parsed = coalesceDefinitionBlocks(
    promoteStructuredParagraphs(blocks).filter(isRenderableBlock),
  );
  LESSON_PARSE_CACHE.set(body, parsed);
  if (LESSON_PARSE_CACHE.size > LESSON_PARSE_CACHE_MAX) {
    const oldest = LESSON_PARSE_CACHE.keys().next().value;
    if (oldest !== undefined) LESSON_PARSE_CACHE.delete(oldest);
  }
  return parsed;
}

function promoteStructuredParagraphs(blocks: BodyBlock[]): BodyBlock[] {
  const next: BodyBlock[] = [];
  for (const block of blocks) {
    if (block.kind !== "paragraph") {
      next.push(block);
      continue;
    }
    const scenario = tryParseScenarioParagraph(block.text);
    if (scenario) {
      const body = [
        scenario.situation,
        scenario.decision ? `Decision: ${scenario.decision}` : "",
        scenario.answer ? `Recommended answer: ${scenario.answer}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      next.push({ kind: "example", title: scenario.title, body });
      continue;
    }
    const definition = tryParseDefinitionParagraph(block.text);
    if (definition) {
      next.push({ kind: "definition", term: definition.term, meaning: definition.meaning });
      continue;
    }
    const inferredDefinition = tryInferDefinitionParagraph(block.text);
    if (inferredDefinition) {
      next.push({
        kind: "definition",
        term: inferredDefinition.term,
        meaning: inferredDefinition.meaning,
      });
      continue;
    }
    const example = tryParseExampleParagraph(block.text);
    if (example) {
      next.push({ kind: "worked_example", title: example.title, body: example.body });
      continue;
    }
    const summary = tryParseSummaryParagraph(block.text);
    if (summary) {
      next.push({ kind: "summary", title: summary.title, body: summary.body });
      continue;
    }
    const inferredScenario = tryInferScenarioParagraph(block.text);
    if (inferredScenario) {
      const body = [
        inferredScenario.situation,
        inferredScenario.decision ? `Decision: ${inferredScenario.decision}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      next.push({ kind: "example", title: inferredScenario.title, body });
      continue;
    }
    const question = tryParseQuestionLead(block.text);
    if (question) {
      next.push({ kind: "question", question: question.question, answer: question.answer });
      continue;
    }
    next.push(block);
  }
  return next;
}

/** Merge "Definition — Term" headings / thin paragraphs with the following meaning block. */
function coalesceDefinitionBlocks(blocks: BodyBlock[]): BodyBlock[] {
  const out: BodyBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const leadText =
      block.kind === "heading"
        ? block.text
        : block.kind === "paragraph"
          ? block.text
          : null;

    if (leadText && isDefinitionLeadLine(leadText)) {
      const alone = tryParseDefinitionParagraph(leadText);
      const next = blocks[i + 1];
      const nextMeaning =
        next?.kind === "paragraph"
          ? next.text
          : next?.kind === "heading"
            ? null
            : null;

      if (next?.kind === "paragraph" && nextMeaning) {
        const merged = tryParseDefinitionParagraph(`${leadText}\n${nextMeaning}`);
        if (merged) {
          out.push({ kind: "definition", term: merged.term, meaning: merged.meaning });
          i += 1;
          continue;
        }
      }

      if (alone) {
        out.push({ kind: "definition", term: alone.term, meaning: alone.meaning });
        continue;
      }
    }

    out.push(block);
  }
  return out.filter(isRenderableBlock);
}

function isRenderableBlock(block: BodyBlock): boolean {
  if (block.kind === "example") return Boolean(block.body.trim());
  if (block.kind === "worked_example") return Boolean(block.body.trim());
  if (block.kind === "summary") return Boolean(block.body.trim());
  if (block.kind === "definition") return Boolean(block.term.trim() && block.meaning.trim());
  if (block.kind === "question") return Boolean(block.question.trim());
  if (block.kind === "paragraph") return Boolean(block.text.trim());
  if (block.kind === "callout") return Boolean(block.text.trim());
  if (block.kind === "takeaways") return block.items.length > 0;
  if (block.kind === "list") return block.items.length > 0;
  if (block.kind === "heading") return Boolean(block.text.trim());
  return true;
}

function splitTableRow(line: string) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cleanDisplayLine(cell.trim()) ?? "");
}

function isTableSeparator(line: string) {
  const compact = line.replace(/\s/g, "");
  if (!compact.includes("-")) return false;
  for (const ch of compact) {
    if (ch !== "|" && ch !== "-" && ch !== ":") return false;
  }
  // Need at least two separator cells worth of dashes/pipes
  return (compact.match(/-/g) ?? []).length >= 3;
}

function parseTableChunk(lines: string[]): Extract<BodyBlock, { kind: "table" }> | null {
  if (lines.length < 2 || lines.some((line) => line.split("|").length < 2)) return null;

  let headers: string[] = [];
  let data = lines;
  if (isTableSeparator(lines[1])) {
    headers = splitTableRow(lines[0]).filter(Boolean);
    data = lines.slice(2);
  } else {
    headers = splitTableRow(lines[0]).filter(Boolean);
    data = lines.slice(1);
  }

  const rows = data
    .filter((line) => !isTableSeparator(line))
    .map((line) => splitTableRow(line))
    .filter((row) => row.some((cell) => cell.trim()));

  if (!rows.length) return null;
  const width = Math.max(headers.length, ...rows.map((row) => row.length));
  if (width < 2) return null;
  return { kind: "table", headers, rows };
}

function parseTextChunks(text: string): BodyBlock[] {
  const chunks = text.trim().split(/\n{2,}/);
  const blocks: BodyBlock[] = [];
  let takeaways: string[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const first = lines[0];

    if (/^key takeaways:?$/i.test(first) || isSummaryLeadLine(first)) {
      if (/^key takeaways:?$/i.test(first)) {
        takeaways = lines
          .slice(1)
          .map((line) => cleanDisplayLine(line.replace(/^[•\-\d.]+\s*/, "")))
          .filter((line): line is string => Boolean(line));
        continue;
      }
      const summary = tryParseSummaryParagraph(lines.join("\n"));
      if (summary) {
        blocks.push({ kind: "summary", title: summary.title, body: summary.body });
        continue;
      }
    }

    const image = parseImageChunk(chunk);
    if (image) {
      blocks.push(image);
      continue;
    }
    if (/!\[[^\]]*\]\(https?:[^)]+\)|<img\b/i.test(chunk)) {
      blocks.push(...splitRichText(chunk));
      continue;
    }

    const table = parseTableChunk(lines);
    if (table) {
      blocks.push(table);
      continue;
    }

    if (lines.every((line) => /^([•\-]|[\d]+\.)\s/.test(line))) {
      const items = lines
        .map((line) => cleanDisplayLine(line.replace(/^([•\-]|[\d]+\.)\s*/, "")))
        .filter((item): item is string => Boolean(item));
      if (items.length) {
        blocks.push({
          kind: "list",
          ordered: /^[\d]+\./.test(first),
          items,
        });
      }
      continue;
    }

    blocks.push(...blocksFromStructuredLines(lines));
  }

  if (takeaways.length) blocks.push({ kind: "takeaways", items: takeaways });
  return blocks;
}

const SCENARIO_LINE = /^(?:\*\*)?(example|scenario)(?:\*\*)?\s*[:：—–-]\s*(.*)$/i;

function isScenarioLine(line: string) {
  return SCENARIO_LINE.test(line.trim());
}

function blocksFromStructuredLines(lines: string[]): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isExampleLeadLine(line)) {
      const lead = line.replace(/^#{1,6}\s*/, "").trim();
      const bodyParts: string[] = [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (
          isDefinitionLeadLine(next) ||
          isExampleLeadLine(next) ||
          isSummaryLeadLine(next) ||
          looksLikeSectionHeading(next) ||
          looksLikeQuestionHeading(next) ||
          isAtxHeadingLine(next) ||
          isScenarioLine(next) ||
          /^\[/.test(next)
        ) {
          break;
        }
        bodyParts.push(next);
        i += 1;
      }
      const parsed = tryParseExampleParagraph([lead, ...bodyParts].join("\n"));
      if (parsed) {
        blocks.push({ kind: "worked_example", title: parsed.title, body: parsed.body });
      }
      continue;
    }

    if (isDefinitionLeadLine(line)) {
      const lead = line.replace(/^#{1,6}\s*/, "").trim();
      const meaningParts: string[] = [];
      // Same-line meaning after the label (Definition — JDK: …)
      const sameLine = tryParseDefinitionParagraph(lead);
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (
          isDefinitionLeadLine(next) ||
          looksLikeSectionHeading(next) ||
          looksLikeQuestionHeading(next) ||
          isAtxHeadingLine(next) ||
          isScenarioLine(next) ||
          /^\[/.test(next)
        ) {
          break;
        }
        meaningParts.push(next);
        i += 1;
      }
      const meaningJoined = meaningParts.join("\n").trim();
      const parsed =
        (meaningJoined
          ? tryParseDefinitionParagraph(`${lead}\n${meaningJoined}`)
          : null) || sameLine;
      if (parsed) {
        blocks.push({ kind: "definition", term: parsed.term, meaning: parsed.meaning });
      } else if (meaningJoined) {
        const withoutLabel = lead.replace(
          /^(?:\*\*)?(definition|key term|term)(?:\*\*)?\s*[:：—–-]\s*/i,
          "",
        ).trim();
        blocks.push({
          kind: "definition",
          term: withoutLabel || "Term",
          meaning: meaningJoined,
        });
      } else {
        // Keep the lead so a following paragraph chunk can coalesce into a card.
        blocks.push({ kind: "paragraph", text: lead });
      }
      continue;
    }

    if (/^#{1,6}(\s|$)/.test(line) || /^\*\*\s*#{1,6}\s*.+\*\*$/.test(line)) {
      const raw = line
        .replace(/^\*\*\s*/, "")
        .replace(/\s*\*\*$/, "")
        .replace(/^(#{1,6})\s*/, (_, hashes: string) => `${hashes} `)
        .replace(/\s+#+\s*$/, "")
        .trim();
      const hashes = raw.match(/^(#{1,6})\s*/)?.[1] ?? "##";
      const level = Math.min(3, Math.max(2, hashes.length)) as 2 | 3;
      const heading = cleanDisplayLine(raw.replace(/^#+\s*/, "").replace(/^#+(?=\S)/, ""));
      if (heading) blocks.push({ kind: "heading", level, text: heading });
      i += 1;
      continue;
    }

    if (looksLikeSectionHeading(line) || looksLikeQuestionHeading(line)) {
      if (looksLikeQuestionHeading(line)) {
        const q = cleanDisplayLine(line.replace(/^\*\*(.+)\*\*$/, "$1"));
        if (q) blocks.push({ kind: "question", question: q, answer: "" });
      } else {
        const heading = cleanDisplayLine(line.replace(/^\*\*(.+)\*\*$/, "$1"));
        if (heading) blocks.push({ kind: "heading", level: 3, text: heading });
      }
      i += 1;
      continue;
    }

    const callout = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (callout && looksLikeCalloutLabel(callout[1])) {
      const rest = [callout[2], ...lines.slice(i + 1)].filter(Boolean).join("\n");
      blocks.push(parseCalloutBlock(callout[1], rest));
      break;
    }

    if (isScenarioLine(line)) {
      const match = line.match(SCENARIO_LINE);
      const inline = (match?.[2] ?? "").trim();
      const titleFromInline = inline && !/\bDecision:|\bRecommended answer:/i.test(inline) && inline.length < 80
        ? inline
        : "";
      const bodyParts: string[] = titleFromInline ? [] : inline ? [inline] : [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (
          looksLikeSectionHeading(next) ||
          looksLikeQuestionHeading(next) ||
          isAtxHeadingLine(next) ||
          isScenarioLine(next) ||
          /^\[/.test(next)
        ) {
          break;
        }
        bodyParts.push(next);
        i += 1;
      }
      const body = bodyParts.join("\n").trim();
      if (body || titleFromInline) {
        blocks.push({
          kind: "example",
          title: titleFromInline || "Applied scenario",
          body: body || titleFromInline,
        });
      }
      continue;
    }

    // Paragraph run until a structural line.
    const para: string[] = [];
    while (i < lines.length) {
      const next = lines[i];
      if (
        looksLikeSectionHeading(next) ||
        looksLikeQuestionHeading(next) ||
        isAtxHeadingLine(next) ||
        isScenarioLine(next) ||
        /^\[/.test(next)
      ) {
        break;
      }
      // Inline "Scenario:" buried after a sentence on the same line
      const scenarioInline = next.match(/^(.*?)\b(Scenario\s*[:—-]\s*[\s\S]+)$/i);
      if (scenarioInline && scenarioInline[1].trim().length > 20) {
        para.push(scenarioInline[1].trim());
        lines.splice(i, 1, scenarioInline[2].trim());
        break;
      }
      para.push(next);
      i += 1;
    }
    if (para.length) {
      const joined = para.join(" ");
      const question = tryParseQuestionLead(joined);
      if (question) {
        blocks.push({ kind: "question", question: question.question, answer: question.answer });
      } else {
        blocks.push(...splitRichText(joined));
      }
    }
  }

  return blocks;
}

function isAtxHeadingLine(line: string) {
  const trimmed = line.trim();
  return (
    /^#{1,6}(\s|$)/.test(trimmed) ||
    /^#{1,6}\S/.test(trimmed) ||
    /^\*\*\s*#{1,6}\s*.+\*\*$/.test(trimmed)
  );
}

function looksLikeSectionHeading(line: string): boolean {
  const text = line.trim().replace(/^\*\*(.+)\*\*$/, "$1").trim();
  if (!text || text.length < 4 || text.length > 100) return false;
  if (isDefinitionLeadLine(text)) return false;
  if (isExampleLeadLine(text) || isSummaryLeadLine(text)) return false;
  if (looksLikeQuestionHeading(text)) return true;
  if (/[.!]$/.test(text)) return false;
  if (/\?$/.test(text)) return false;
  if (/^([•\-]|[\d]+\.)\s/.test(text)) return false;
  if (isAtxHeadingLine(text) || /^\[/.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (!/^[A-Z0-9]/.test(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 14) return false;

  if (/^(when to|how to|why |what |where |overview|summary|key |step \d|part \d)/i.test(text)) {
    return true;
  }
  // Acronym section labels: "DFS: …", "BFS vs DFS"
  if (/^[A-Z]{2,}(\+[A-Z]+)*\b/.test(text)) return true;

  const small = /^(vs|and|or|in|of|to|for|a|an|the|on|at|by|with|from)$/i;
  const titleLike = words.filter((word) => /^[A-Z0-9]/.test(word) || small.test(word)).length;
  return titleLike / words.length >= 0.65;
}

function parseCalloutBlock(raw: string, text: string): BodyBlock {
  const parsed = unwrapCalloutSource(`[${raw}] ${text}`);
  return {
    kind: "callout",
    variant: parsed.variant,
    title: parsed.title,
    text: parsed.text,
  };
}
