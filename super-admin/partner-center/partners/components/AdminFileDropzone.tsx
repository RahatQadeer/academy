"use client";

import { useRef } from "react";

export function AdminFileDropzone({
  file,
  onFile,
  disabled,
  label = "Drop a file or click to browse",
  hint = "PDF, DOCX, or image up to 25MB",
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (disabled) return;
        const dropped = event.dataTransfer.files?.[0] ?? null;
        if (dropped) onFile(dropped);
      }}
      className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[8px] px-4 py-7 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        border: "1.5px dashed var(--border-strong)",
        background: "var(--surface-soft)",
      }}
    >
      <span
        className="text-[13.5px] font-medium"
        style={{ color: "var(--ink)" }}
      >
        {file ? file.name : label}
      </span>
      <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {file ? "Click to replace" : hint}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
        }}
      />
    </button>
  );
}
