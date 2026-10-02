"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { parseExerciseFence } from "@/academy/lib/lessonExercise";
import {
  tryParseDefinitionParagraph,
  tryParseScenarioParagraph,
} from "@/academy/lib/lessonContentDesign";

/**
 * Card-based lesson editor for non-developers.
 * Authors fill labeled fields — never type ##, **, or fence syntax.
 * Serializes back to the markdown LessonBody already understands.
 */

export type LessonEditBlock =
  | { id: string; kind: "heading"; text: string }
  | { id: string; kind: "paragraph"; text: string }
  | { id: string; kind: "definition"; term: string; meaning: string }
  | {
      id: string;
      kind: "scenario";
      title: string;
      situation: string;
      decision: string;
      answer: string;
    }
  | {
      id: string;
      kind: "exercise";
      prompt: string;
      options: string;
      answer: string;
      explanation: string;
    }
  | { id: string; kind: "code"; language: string; code: string };

let blockSeq = 0;
function nextId() {
  blockSeq += 1;
  return `b${blockSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

export function parseLessonToBlocks(markdown: string): LessonEditBlock[] {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return [{ id: nextId(), kind: "paragraph", text: "" }];

  const blocks: LessonEditBlock[] = [];
  const fence = /```([\w-]*)\s*\n?([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) {
      blocks.push(...parsePlainChunk(text.slice(last, match.index)));
    }
    const lang = (match[1] || "code").trim() || "code";
    const inner = match[2].replace(/\n$/, "");
    if (lang.toLowerCase() === "exercise") {
      const exercise = parseExerciseFence(inner);
      if (exercise) {
        blocks.push({
          id: nextId(),
          kind: "exercise",
          prompt: exercise.prompt,
          options: exercise.options.join(" | "),
          answer: exercise.answer,
          explanation: exercise.explanation ?? "",
        });
      } else {
        blocks.push({ id: nextId(), kind: "code", language: "exercise", code: inner });
      }
    } else {
      blocks.push({ id: nextId(), kind: "code", language: lang, code: inner });
    }
    last = fence.lastIndex;
  }
  if (last < text.length) {
    blocks.push(...parsePlainChunk(text.slice(last)));
  }

  return blocks.length > 0 ? blocks : [{ id: nextId(), kind: "paragraph", text: "" }];
}

function parsePlainChunk(chunk: string): LessonEditBlock[] {
  const parts = chunk.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const out: LessonEditBlock[] = [];

  for (const part of parts) {
    if (/^#{1,3}\s+/.test(part)) {
      const lines = part.split("\n");
      const first = lines[0] ?? "";
      out.push({
        id: nextId(),
        kind: "heading",
        text: first.replace(/^#{1,3}\s+/, "").trim(),
      });
      const rest = lines.slice(1).join("\n").trim();
      if (rest) out.push(...parsePlainChunk(rest));
      continue;
    }

    const scenario = tryParseScenarioParagraph(part);
    if (scenario) {
      out.push({
        id: nextId(),
        kind: "scenario",
        title: scenario.title,
        situation: scenario.situation,
        decision: scenario.decision,
        answer: scenario.answer,
      });
      continue;
    }

    const definition = tryParseDefinitionParagraph(part);
    if (definition) {
      out.push({
        id: nextId(),
        kind: "definition",
        term: definition.term,
        meaning: definition.meaning,
      });
      continue;
    }

    // Heading-like single line without hashes
    if (part.length < 90 && !part.includes("\n") && !/[.!?]$/.test(part) && /^[A-Z]/.test(part)) {
      // still treat as paragraph — safer than guessing headings
    }

    out.push({ id: nextId(), kind: "paragraph", text: part });
  }

  return out;
}

export function blocksToLessonMarkdown(blocks: LessonEditBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return block.text.trim() ? `## ${block.text.trim()}` : "";
        case "paragraph":
          return block.text.trim();
        case "definition":
          if (!block.term.trim() && !block.meaning.trim()) return "";
          return `Definition — ${block.term.trim()}\n${block.meaning.trim()}`;
        case "scenario": {
          const lines = [
            `Scenario — ${block.title.trim() || "Scenario"}`,
            block.situation.trim(),
            block.decision.trim() ? `Decision: ${block.decision.trim()}` : "",
            block.answer.trim() ? `Recommended answer: ${block.answer.trim()}` : "",
          ].filter(Boolean);
          return lines.join("\n");
        }
        case "exercise":
          return [
            "```exercise",
            `PROMPT: ${block.prompt.trim() || "Complete the example."}`,
            "CODE:",
            "[[ ]]",
            `OPTIONS: ${block.options.trim() || "A | B | C | D"}`,
            `ANSWER: ${block.answer.trim() || "A"}`,
            `EXPLANATION: ${block.explanation.trim() || "Why this answer is correct."}`,
            "```",
          ].join("\n");
        case "code":
          return `\`\`\`${block.language.trim() || "text"}\n${block.code}\n\`\`\``;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

const ADD_OPTIONS: { kind: LessonEditBlock["kind"]; label: string }[] = [
  { kind: "heading", label: "Heading" },
  { kind: "paragraph", label: "Paragraph" },
  { kind: "definition", label: "Definition" },
  { kind: "scenario", label: "Scenario" },
  { kind: "exercise", label: "Exercise" },
  { kind: "code", label: "Code sample" },
];

function emptyBlock(kind: LessonEditBlock["kind"]): LessonEditBlock {
  switch (kind) {
    case "heading":
      return { id: nextId(), kind, text: "" };
    case "paragraph":
      return { id: nextId(), kind, text: "" };
    case "definition":
      return { id: nextId(), kind, term: "", meaning: "" };
    case "scenario":
      return { id: nextId(), kind, title: "", situation: "", decision: "", answer: "" };
    case "exercise":
      return {
        id: nextId(),
        kind,
        prompt: "",
        options: "Option A | Option B | Option C | Option D",
        answer: "Option A",
        explanation: "",
      };
    case "code":
      return { id: nextId(), kind, language: "js", code: "" };
  }
}

function kindLabel(kind: LessonEditBlock["kind"]) {
  switch (kind) {
    case "heading":
      return "Heading";
    case "paragraph":
      return "Paragraph";
    case "definition":
      return "Definition";
    case "scenario":
      return "Scenario";
    case "exercise":
      return "Exercise";
    case "code":
      return "Code sample";
  }
}

export function LessonBlockEditor({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const initial = useMemo(() => parseLessonToBlocks(value), []);
  const [blocks, setBlocks] = useState<LessonEditBlock[]>(initial);
  const [sourceKey, setSourceKey] = useState(value);

  // Re-parse when parent replaces content from outside (e.g. Whitby rewrite / lesson switch).
  useEffect(() => {
    if (value === sourceKey) return;
    const serialized = blocksToLessonMarkdown(blocks);
    if (value === serialized) {
      setSourceKey(value);
      return;
    }
    setBlocks(parseLessonToBlocks(value));
    setSourceKey(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(next: LessonEditBlock[]) {
    setBlocks(next);
    const markdown = blocksToLessonMarkdown(next);
    setSourceKey(markdown);
    onChange(markdown);
  }

  function updateBlock(id: string, patch: Partial<LessonEditBlock>) {
    commit(
      blocks.map((block) => (block.id === id ? ({ ...block, ...patch } as LessonEditBlock) : block)),
    );
  }

  function removeBlock(id: string) {
    const next = blocks.filter((block) => block.id !== id);
    commit(next.length > 0 ? next : [emptyBlock("paragraph")]);
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    commit(next);
  }

  function addBlock(kind: LessonEditBlock["kind"]) {
    commit([...blocks, emptyBlock(kind)]);
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Build the lesson in plain cards. Click a button below to add a heading, paragraph, definition,
        scenario, or exercise — no special symbols needed.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {ADD_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            disabled={disabled}
            onClick={() => addBlock(option.kind)}
            className="rounded-[8px] border px-2.5 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
            style={{
              borderColor: "var(--border-strong)",
              color: "var(--ink)",
              background: "var(--surface)",
            }}
          >
            + {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <article
            key={block.id}
            className="rounded-[10px] border p-3.5 sm:p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
              >
                {kindLabel(block.kind)}
              </span>
              <div className="flex items-center gap-1">
                <IconBtn
                  label="Move up"
                  disabled={disabled || index === 0}
                  onClick={() => moveBlock(block.id, -1)}
                >
                  ↑
                </IconBtn>
                <IconBtn
                  label="Move down"
                  disabled={disabled || index === blocks.length - 1}
                  onClick={() => moveBlock(block.id, 1)}
                >
                  ↓
                </IconBtn>
                <IconBtn label="Remove" disabled={disabled} onClick={() => removeBlock(block.id)}>
                  Remove
                </IconBtn>
              </div>
            </div>

            {block.kind === "heading" ? (
              <Input
                label="Heading text"
                value={block.text}
                disabled={disabled}
                placeholder="Section title"
                onChange={(e) => updateBlock(block.id, { text: e.target.value })}
              />
            ) : null}

            {block.kind === "paragraph" ? (
              <Field label="Paragraph">
                <textarea
                  value={block.text}
                  disabled={disabled}
                  rows={4}
                  placeholder="Write in plain sentences…"
                  onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </Field>
            ) : null}

            {block.kind === "definition" ? (
              <div className="space-y-3">
                <Input
                  label="Term"
                  value={block.term}
                  disabled={disabled}
                  placeholder="e.g. Call stack"
                  onChange={(e) => updateBlock(block.id, { term: e.target.value })}
                />
                <Field label="Meaning">
                  <textarea
                    value={block.meaning}
                    disabled={disabled}
                    rows={3}
                    placeholder="Explain it in one or two clear sentences"
                    onChange={(e) => updateBlock(block.id, { meaning: e.target.value })}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
              </div>
            ) : null}

            {block.kind === "scenario" ? (
              <div className="space-y-3">
                <Input
                  label="Title"
                  value={block.title}
                  disabled={disabled}
                  placeholder="Short scenario title"
                  onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                />
                <Field label="Situation">
                  <textarea
                    value={block.situation}
                    disabled={disabled}
                    rows={3}
                    placeholder="What is happening?"
                    onChange={(e) => updateBlock(block.id, { situation: e.target.value })}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Input
                  label="Decision for the learner"
                  value={block.decision}
                  disabled={disabled}
                  placeholder="What should they choose or do?"
                  onChange={(e) => updateBlock(block.id, { decision: e.target.value })}
                />
                <Field label="Recommended answer (hidden until reveal)">
                  <textarea
                    value={block.answer}
                    disabled={disabled}
                    rows={2}
                    placeholder="Teaching explanation"
                    onChange={(e) => updateBlock(block.id, { answer: e.target.value })}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
              </div>
            ) : null}

            {block.kind === "exercise" ? (
              <div className="space-y-3">
                <Field label="Prompt for the learner">
                  <textarea
                    value={block.prompt}
                    disabled={disabled}
                    rows={2}
                    placeholder="What should they practice?"
                    onChange={(e) => updateBlock(block.id, { prompt: e.target.value })}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Input
                  label="Choices (separate with | )"
                  value={block.options}
                  disabled={disabled}
                  placeholder="A | B | C | D"
                  onChange={(e) => updateBlock(block.id, { options: e.target.value })}
                />
                <Input
                  label="Correct choice"
                  value={block.answer}
                  disabled={disabled}
                  onChange={(e) => updateBlock(block.id, { answer: e.target.value })}
                />
                <Input
                  label="Explanation (shown after answer)"
                  value={block.explanation}
                  disabled={disabled}
                  onChange={(e) => updateBlock(block.id, { explanation: e.target.value })}
                />
              </div>
            ) : null}

            {block.kind === "code" ? (
              <div className="space-y-3">
                <Input
                  label="Language"
                  value={block.language}
                  disabled={disabled}
                  placeholder="js"
                  onChange={(e) => updateBlock(block.id, { language: e.target.value })}
                />
                <Field label="Code">
                  <textarea
                    value={block.code}
                    disabled={disabled}
                    rows={6}
                    placeholder="Paste a short code sample"
                    onChange={(e) => updateBlock(block.id, { code: e.target.value })}
                    className={`${fieldClass} font-mono text-[13px]`}
                    style={fieldStyle}
                  />
                </Field>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => addBlock("paragraph")}
      >
        Add another paragraph
      </Button>
    </div>
  );
}

const fieldClass =
  "w-full rounded-[8px] border px-3 py-2 text-[14px] leading-[1.6] outline-none focus:border-[var(--accent)]";
const fieldStyle = { borderColor: "var(--border-strong)", color: "var(--ink)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-[6px] px-2 py-1 text-[12px] font-medium disabled:opacity-40"
      style={{
        color: "var(--text-secondary)",
        background: "var(--surface-soft)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}

/** @deprecated Use LessonBlockEditor — kept so old imports fail loudly if any remain. */
export function LessonRichTextEditor(props: {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  return <LessonBlockEditor {...props} />;
}
