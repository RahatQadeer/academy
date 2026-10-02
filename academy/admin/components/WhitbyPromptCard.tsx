"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { cn } from "@/base/lib/cn";
import {
  kindLabel,
  type CourseGenAttachmentKind,
} from "@/academy/admin/lib/courseAttachmentText";
import {
  normalizeWhitbyAttachments,
  readWhitbyAttachmentFile,
  saveWhitbyBuilderAttachments,
  type WhitbyBuilderAttachment,
} from "@/academy/admin/lib/whitbyBuilderAttachments";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import { CourseTagsFieldLoader } from "@/academy/components/CourseTagsFieldLoader";
import { validateProgramTagIds } from "@/academy/lib/courseTags/constants";

const MIN_MODULES = 1;
const MAX_MODULES = 12;
const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
/** Whitby Type = pricing only. Program kind (Course / Short Course / …) is set in Settings. */
const TYPE_OPTIONS = ["Free", "Paid"];
const LENGTH_OPTIONS = Array.from({ length: MAX_MODULES - MIN_MODULES + 1 }, (_, i) => {
  const n = MIN_MODULES + i;
  return { value: String(n), label: String(n), hint: n === 1 ? "module" : "modules" };
});

function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11.2 4.2 6.4 9a1.6 1.6 0 1 0 2.3 2.3l5.4-5.4a3.1 3.1 0 1 0-4.4-4.4L4.3 7.3a4.7 4.7 0 1 0 6.6 6.6l5.8-5.8"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="ml-1">
      <path
        d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BuilderSelect({
  label,
  value,
  options,
  onChange,
  className,
  placeholder = "Select",
}: {
  label: string;
  value: string;
  options: { value: string; label: string; hint?: string }[];
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <FilterSelect
        label={label}
        value={value}
        options={options}
        placeholder={placeholder}
        size="xs"
        onChange={onChange}
      />
    </div>
  );
}

function AttachmentStatus({
  file,
  onRemove,
}: {
  file: WhitbyBuilderAttachment;
  onRemove: () => void;
}) {
  const kind = (file.kind ?? "txt") as CourseGenAttachmentKind;
  const lines =
    kind === "pdf"
      ? [
          `${kindLabel(kind)} parsed successfully`,
          `${file.pageCount || 1} page${(file.pageCount || 1) === 1 ? "" : "s"} analyzed`,
          "Ready to generate",
        ]
      : kind === "docx"
        ? [
            `${kindLabel(kind)} parsed successfully`,
            "Document content extracted",
            "Ready to generate",
          ]
        : [
            `${kindLabel(kind)} parsed successfully`,
            "Document content extracted",
            "Ready to generate",
          ];

  return (
    <div
      className="rounded-[8px] px-2.5 py-2"
      style={{ background: "var(--surface-soft)", boxShadow: "inset 0 0 0 1px var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[12.5px] font-medium text-ink">
          File: <span className="break-all">{file.name}</span>
        </p>
        <button
          type="button"
          aria-label={`Remove ${file.name}`}
          onClick={onRemove}
          className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-[15px] leading-none"
          style={{ color: "var(--text-tertiary)" }}
        >
          ×
        </button>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
        {lines.map((line) => (
          <li key={line}>✓ {line}</li>
        ))}
      </ul>
    </div>
  );
}

export function WhitbyPromptCard({
  generatePath = "/academy/admin/catalog/generating",
  framed = true,
}: {
  generatePath?: string;
  framed?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState("");
  const [length, setLength] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<WhitbyBuilderAttachment[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);
  const [parsingLabel, setParsingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const promptId = useId();
  const errorId = useId();
  const fileInputId = useId();

  async function handleFiles(selected: FileList | null) {
    if (!selected?.length) return;
    setReadingFiles(true);
    setError(null);

    try {
      const next = [...attachments];
      for (const file of Array.from(selected)) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "file";
        setParsingLabel(
          ext === "pdf" ? `Parsing ${file.name}…` : ext === "docx" ? `Extracting ${file.name}…` : `Reading ${file.name}…`,
        );
        const attachment = await readWhitbyAttachmentFile(file, next.length);
        next.push(attachment);
      }
      setAttachments(normalizeWhitbyAttachments(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse the selected file. Try another file or paste the text.");
    } finally {
      setReadingFiles(false);
      setParsingLabel(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(name: string) {
    setAttachments((current) => current.filter((file) => file.name !== name));
  }

  const hasSource =
    Boolean(prompt.trim()) || attachments.some((file) => file.parsed && file.content.trim());
  const hasCourseOptions = Boolean(length && difficulty && type);
  const tagsOk = !validateProgramTagIds(tagIds);
  const canGenerate = hasSource && hasCourseOptions && tagsOk && !pending && !readingFiles;

  return (
    <section
      aria-label="Build a program with Whitby"
      className={cn(framed && "overflow-hidden rounded-[10px] bg-surface")}
      style={framed ? { border: "1px solid var(--border)" } : undefined}
    >
      <div
        className={cn(
          "relative overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4",
          !framed && "rounded-[10px]",
        )}
        style={{
          background:
            "linear-gradient(135deg, var(--accent-tint) 0%, var(--surface) 42%, var(--accent-tint-soft) 100%)",
        }}
      >
        <div className="relative mb-3 flex items-center gap-2.5">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[12px] font-bold text-white"
            style={{ background: "var(--accent)" }}
            aria-hidden
          >
            W
          </span>
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--accent)" }}
            >
              Whitby
            </p>
            <h3 className="text-[15px] font-semibold tracking-[-0.2px] text-ink">
              Build a program
            </h3>
          </div>
        </div>

        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            const instruction =
              prompt.trim() ||
              (attachments.length > 0 ? "Create a course from the attached document." : "");
            if (!instruction) {
              setError("Describe the program you want Whitby to build, or attach a source document.");
              return;
            }
            if (!length || !difficulty || !type) {
              setError("Select type (Free or Paid), length, and level before generating.");
              return;
            }
            const tagError = validateProgramTagIds(tagIds);
            if (tagError) {
              setError(tagError);
              return;
            }
            if (readingFiles) {
              setError("Wait for the attached file to finish parsing.");
              return;
            }
            setError(null);
            saveWhitbyBuilderAttachments(normalizeWhitbyAttachments(attachments));
            const query = new URLSearchParams({
              prompt: instruction,
              length: `${length} modules`,
              difficulty,
              type,
              tags: tagIds.join(","),
            });
            startTransition(() => {
              router.push(`${generatePath}?${query.toString()}`);
            });
          }}
        >
          <div
            className={cn(
              "overflow-hidden rounded-[10px] bg-surface transition-[box-shadow,border-color]",
              focused && "ring-2 ring-[color:var(--accent)]/20",
            )}
            style={{
              border: error
                ? "1px solid var(--danger-fg)"
                : focused
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
              boxShadow: focused
                ? "0 8px 20px rgba(15,15,15,.05)"
                : "0 1px 2px rgba(15,15,15,.04)",
            }}
          >
            <label htmlFor={promptId} className="sr-only">
              Describe the program
            </label>
            <textarea
              id={promptId}
              rows={3}
              value={prompt}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              placeholder="Describe the program. Whitby drafts modules, lessons, and assessments you can refine before publishing."
              className="h-[84px] w-full resize-none border-none bg-transparent px-3.5 pt-3 pb-2 text-[13.5px] leading-[1.5] text-ink outline-none placeholder:text-[color:var(--text-disabled)] sm:h-[88px] sm:px-4"
            />

            {attachments.length > 0 ? (
              <div className="space-y-2 border-t px-3.5 py-2.5 sm:px-4" style={{ borderColor: "var(--border)" }}>
                {attachments.map((file) => (
                  <AttachmentStatus key={file.name} file={file} onRemove={() => removeAttachment(file.name)} />
                ))}
              </div>
            ) : null}

            {parsingLabel ? (
              <p className="px-3.5 pb-2 text-[12px] sm:px-4" style={{ color: "var(--text-secondary)" }}>
                {parsingLabel}
              </p>
            ) : null}

            <div
              className="flex flex-wrap items-end gap-x-3 gap-y-2.5 border-t px-3 py-3 sm:px-4"
              style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
            >
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.csv,.json,.pdf,.docx,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(event) => void handleFiles(event.target.files)}
              />

              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-3 gap-y-2.5">
                <BuilderSelect
                  label="Length"
                  value={length}
                  options={LENGTH_OPTIONS}
                  placeholder="Select"
                  onChange={(next) => {
                    setLength(next);
                    if (error) setError(null);
                  }}
                  className="w-[7.25rem] shrink-0"
                />
                <BuilderSelect
                  label="Level"
                  value={difficulty}
                  options={DIFFICULTY_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                  placeholder="Select"
                  onChange={(next) => {
                    setDifficulty(next);
                    if (error) setError(null);
                  }}
                  className="w-[7.25rem] shrink-0"
                />
                <BuilderSelect
                  label="Type"
                  value={type}
                  options={TYPE_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                  placeholder="Select"
                  onChange={(next) => {
                    setType(next);
                    if (error) setError(null);
                  }}
                  className="w-[7.25rem] shrink-0"
                />
                <div className="w-[7.25rem] shrink-0">
                  <CourseTagsFieldLoader
                    compact
                    value={tagIds}
                    disabled={pending || readingFiles}
                    onChange={(next) => {
                      setTagIds(next);
                      if (error) setError(null);
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={readingFiles || attachments.length >= 5}
                title="Attach PDF, Word (.docx), .txt, .md, .csv, or .json"
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] border bg-surface px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-55"
                style={{ color: "var(--text-secondary)", borderColor: "var(--border-strong)" }}
              >
                <PaperclipIcon />
                {readingFiles
                  ? parsingLabel?.startsWith("Parsing")
                    ? "Parsing…"
                    : "Reading…"
                  : attachments.length > 0
                    ? `Attach (${attachments.length})`
                    : "Attach"}
              </button>

              <Button
                type="submit"
                variant="primary"
                disabled={!canGenerate}
                unsized
                className="h-8 shrink-0 px-3 text-[12.5px]"
              >
                {pending ? "Generating…" : "Generate"}
                {!pending ? <ArrowIcon /> : null}
              </Button>
            </div>
          </div>

          {error ? (
            <p id={errorId} role="alert" className="mt-2 text-[12.5px]" style={{ color: "var(--danger-fg)" }}>
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
