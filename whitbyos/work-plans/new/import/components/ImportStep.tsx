"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Callout } from "@/base/components/Callout";
import { importWorkPlan } from "@/whitbyos/work-plans/actions";
import { ACCEPTED_EXTENSIONS, formatOf, type ImportFormat } from "@/whitbyos/lib/import-formats";

const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] text-ink";
const LABEL = "mb-1.5 block text-[12.5px] font-medium";

/**
 * WP.12 and WP.13 — Upload, and Converting.
 *
 * One component for the same reason Configure and Generating are: the
 * conversion is a model call this form is waiting on, and a separate page would
 * either poll for it or sit blank.
 */
export function ImportStep({
  clientId,
  clientName,
  name,
  error,
}: {
  clientId: string;
  clientName: string | null;
  /** A name typed on WP.3, which this screen's own field starts from. */
  name: string;
  error?: string;
}) {
  // Held here rather than in the DropZone, because WP.13's waiting screen
  // names the file and by then the DropZone is gone.
  const [file, setFile] = useState<File | null>(null);

  return (
    <form action={importWorkPlan} className="flex flex-1 flex-col">
      <input type="hidden" name="client_id" value={clientId} />
      <Body clientName={clientName} name={name} error={error} file={file} onFile={setFile} />
    </form>
  );
}

function Body({
  clientName,
  name,
  error,
  file,
  onFile,
}: {
  clientName: string | null;
  name: string;
  error?: string;
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const { pending } = useFormStatus();

  if (pending) return <Converting file={file} />;

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8 sm:py-10 xl:px-10">
      <div className="flex w-full max-w-[600px] flex-col gap-[18px]">
        <div className="text-center">
          <h1 className="mb-1 text-[21px] font-bold">Import a Work Plan</h1>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Upload a document or worksheet, Whitby will convert it into a
            structured Work Plan.
          </p>
        </div>

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <DropZone file={file} onFile={onFile} />

        {/* The paste box outlives the uploader: a plan half-written in an
            email has no file, and a scan longer than Whitby will read has one
            nobody can use. */}
        <label className="flex flex-col gap-1.5">
          <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
            Or paste it
          </span>
          <textarea
            name="pasted"
            className={`${CONTROL} min-h-[150px] resize-y font-mono text-[12.5px]`}
            placeholder={"Phase 1: Visas\n  Collect documents\n  File applications\n\nPhase 2: Housing\n  Shortlist areas"}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
            Plan name <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
          </span>
          <input
            name="name"
            defaultValue={name}
            className={CONTROL}
            placeholder={clientName ? `e.g. ${clientName}, from spreadsheet` : "e.g. Office move, from spreadsheet"}
          />
        </label>

        <button
          type="submit"
          className="self-end rounded-control px-[18px] py-[11px] text-[14px] font-medium text-white"
          style={{ background: "var(--accent)" }}
        >
          Convert to Work Plan →
        </button>
      </div>
    </div>
  );
}

/**
 * WP.12's upload area — the whole panel is the control.
 *
 * A label wrapping a hidden input, so clicking anywhere in it opens the
 * picker and the keyboard reaches it as a file field. Dropping is handled too,
 * because the panel says "drag a file here" and a target that only accepts
 * clicks after saying that is a broken promise.
 */
function DropZone({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function take(list: FileList | null) {
    onFile(list && list.length > 0 ? list[0] : null);
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          if (input.current && event.dataTransfer.files.length > 0) {
            input.current.files = event.dataTransfer.files;
            take(event.dataTransfer.files);
          }
        }}
        className="flex cursor-pointer flex-col items-center gap-2.5 rounded-[10px] border-2 border-dashed p-12 text-center transition-colors"
        style={{
          borderColor: over ? "var(--accent)" : "var(--border-strong)",
          background: over ? "var(--accent-tint-soft)" : undefined,
        }}
      >
        <input
          ref={input}
          type="file"
          name="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={(event) => take(event.target.files)}
          className="sr-only"
        />

        <span
          className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[18px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          aria-hidden
        >
          ⇧
        </span>

        <span className="text-[14px] font-medium">Drag a file here, or click to browse</span>

        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Supports .docx, .xlsx, .csv, .pdf
        </span>
      </label>

      {file ? (
        <div className="flex items-center gap-2.5 rounded-[8px] border border-line px-3.5 py-3">
          <span className="text-[14px]" style={{ color: "var(--accent)" }} aria-hidden>
            ❐
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px]">{file.name}</span>
          <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
            {file.size < 1024
              ? `${file.size} B`
              : file.size < 1024 * 1024
                ? `${Math.round(file.size / 1024)} KB`
                : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
          </span>
          <button
            type="button"
            onClick={() => {
              if (input.current) input.current.value = "";
              onFile(null);
            }}
            aria-label={`Remove ${file.name}`}
            className="text-[13px]"
            style={{ color: "var(--text-disabled)" }}
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * WP.13 — Converting.
 *
 * The reference's first line reports what was found — "Parsed spreadsheet — 6
 * sheets, 34 rows". The kind of file is here, because the name says it. The
 * counts are not: the parse is what this screen is waiting on, so at the
 * moment the line is drawn nobody has counted anything. It says what is being
 * done instead, which is the most a progress screen can honestly claim while
 * it is still running.
 */
function Converting({ file }: { file: File | null }) {
  const steps = [
    file ? `Parsing ${KIND[formatOf(file) ?? "text"]}` : "Reading what you gave it",
    "Extracting tasks, owners and dates",
    "Mapping rows to Work Streams",
    "Finalizing plan",
  ];

  return (
    <div className="flex flex-1 items-center justify-center px-10 py-20">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-5 text-center">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[10px]"
          style={{ background: "var(--ink)" }}
          aria-hidden
        >
          <span className="text-[18px] font-bold text-white">W</span>
        </div>

        <div>
          <div className="mb-1 text-[18px] font-bold">
            {file ? (
              <>
                Converting <span className="break-all">{file.name}</span>
              </>
            ) : (
              "Converting your plan"
            )}
          </div>
          <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            This usually takes under a minute.
          </div>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-[3px]"
          style={{ background: "var(--border)" }}
          role="progressbar"
          aria-label="Converting"
        >
          <div className="pa-progress-indeterminate h-full" style={{ background: "var(--accent)" }} />
        </div>

        <div className="flex w-full flex-col gap-2.5 text-left">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-2.5">
              <span
                className="w-[18px] shrink-0 text-[13px]"
                style={{
                  color:
                    index < 2
                      ? "var(--success-fg)"
                      : index === 2
                        ? "var(--accent)"
                        : "rgba(55,53,47,.3)",
                }}
                aria-hidden
              >
                {index < 2 ? (
                  "\u2713"
                ) : index === 2 ? (
                  <span className="pa-step-running">\u25d0</span>
                ) : (
                  "\u25cb"
                )}
              </span>
              <span
                className="text-[13px]"
                style={{ color: index > 2 ? "var(--text-quiet)" : "var(--ink)" }}
              >
                {step}
                {index === 2 ? "\u2026" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** What the first line of WP.13 calls each format. */
const KIND: Record<ImportFormat, string> = {
  text: "the file",
  docx: "the document",
  xlsx: "the spreadsheet",
  pdf: "the PDF",
};
