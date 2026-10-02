"use client";

import { useRef, useState, type RefObject } from "react";
import { cn } from "@/base/lib/cn";
import {
  DOCUMENT_FILE_ACCEPT,
  isAllowedDocumentFile,
  isInboxLink,
} from "@/whitbyos/lib/document-vocab";

/**
 * 12.2 and 12.6 — a dashed dropzone that still posts as `name="file"`.
 *
 * The dialogs are server components wrapping a form, so this only owns the
 * file input: drag onto the box, or click to browse, and the chosen file is
 * what the action receives. `inputRef` lets a parent (the signed-copy form)
 * share that input with a signature pad.
 */
export function FileDropzone({
  name = "file",
  prompt = "Drop a file here or click to browse",
  hint = "PDF, DOCX, XLSX, PNG, or JPG up to 25MB",
  accept = DOCUMENT_FILE_ACCEPT,
  inputRef,
}: {
  name?: string;
  prompt?: string;
  hint?: string;
  accept?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const localRef = useRef<HTMLInputElement>(null);
  const fileInput = inputRef ?? localRef;
  const [fileName, setFileName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  function take(file: File | undefined, uri = "") {
    const input = fileInput.current;
    if (!input) return;
    if (isInboxLink(uri) || (file && isInboxLink(file.name))) {
      setProblem("Save the file first, then drop it here. A Gmail link is not a document.");
      setFileName(null);
      input.value = "";
      return;
    }
    if (!file) return;
    if (!isAllowedDocumentFile(file)) {
      setProblem("Use a PDF, Word, Excel, PNG, or JPG, not a Gmail or browser shortcut.");
      setFileName(null);
      input.value = "";
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setProblem(null);
    setFileName(file.name);
  }

  return (
    <div>
      <input
        ref={fileInput}
        id={name}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => take(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const uri =
            event.dataTransfer.getData("text/uri-list") ||
            event.dataTransfer.getData("text/plain");
          take(event.dataTransfer.files[0], uri);
        }}
        className={cn(
          "w-full rounded-[8px] border-[1.5px] border-dashed px-4 py-7 text-center",
          over ? "border-accent bg-[var(--accent-tint-mid)]" : "border-line-strong bg-surface",
        )}
      >
        <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
          {fileName ?? prompt}
        </div>
        <div className="mt-1 text-[12px]" style={{ color: problem ? "var(--danger-fg)" : "var(--text-tertiary)" }}>
          {problem ?? (fileName ? "Click or drop to replace" : hint)}
        </div>
      </button>
    </div>
  );
}
