"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/base/lib/supabase/client";
import { fileNameFromPath, isHttpUrl } from "@/academy/lesson-player/utils/curriculum";

const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.png,.jpg,.jpeg,application/pdf";
const MAX_BYTES = 20 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export function AssignmentFileBlock({
  programId,
  lessonId,
  fileUrl,
  canUpload,
  disabled,
  onChange,
}: {
  programId: string;
  lessonId: string;
  fileUrl: string;
  canUpload?: boolean;
  disabled?: boolean;
  onChange: (fileUrl: string) => void;
}) {
  const [href, setHref] = useState<string | null>(null);
  const [resolved, setResolved] = useState(!fileUrl.trim());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = fileUrl.trim() ? fileNameFromPath(fileUrl) : "";

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!fileUrl.trim()) {
        setHref(null);
        setResolved(true);
        return;
      }
      setResolved(false);
      if (isHttpUrl(fileUrl)) {
        if (!cancelled) {
          setHref(fileUrl.trim());
          setResolved(true);
        }
        return;
      }
      const supabase = createClient();
      const path = fileUrl.replace(/^\/+/, "").replace(/^academy\//, "");
      const { data, error: signedError } = await supabase.storage
        .from("academy")
        .createSignedUrl(path, 60 * 60);
      if (cancelled) return;
      if (signedError || !data?.signedUrl) {
        setHref(null);
        setResolved(true);
        return;
      }
      setHref(data.signedUrl);
      setResolved(true);
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  async function onFile(file: File) {
    if (file.size > MAX_BYTES) {
      setError("Keep the assignment file under 20 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const fileName = safeFileName(file.name || "assignment");
      const path = `catalog/${programId}/${lessonId}/assignment/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("academy").upload(path, file, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      onChange(path);
    } finally {
      setUploading(false);
    }
  }

  if (!fileUrl.trim() && !canUpload) {
    if (!resolved && fileUrl.trim()) {
      return (
        <div
          className="h-[72px] animate-pulse rounded-[10px]"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
          aria-hidden
        />
      );
    }
    return null;
  }

  return (
    <section className="space-y-3">
      {fileUrl.trim() ? (
        <div
          className="flex items-start gap-3 rounded-[10px] border px-4 py-3.5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <span
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
            style={{ background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }}
            aria-hidden
          >
            <FileGlyph />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>
              {label}
            </p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Learners download this with the assignment brief.
            </p>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-[13px] font-medium no-underline hover:text-accent-hover"
                style={{ color: "var(--accent)" }}
              >
                Open file
              </a>
            ) : resolved ? (
              <p className="mt-2 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                File is saved. Preview is unavailable in this session.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-[132px] flex-col items-center justify-center rounded-[10px] border border-dashed px-4 text-center"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
        >
          <span
            className="mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-[8px]"
            style={{ background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }}
            aria-hidden
          >
            <FileGlyph />
          </span>
          <p className="text-[13.5px] leading-relaxed">
            Upload the assignment file. Learners will download it with the brief.
          </p>
        </div>
      )}
      {canUpload ? (
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex cursor-pointer rounded-[6px] border px-3 py-1.5 text-[13px] font-medium"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
          >
            {uploading ? "Uploading…" : fileUrl ? "Replace file" : "Upload assignment"}
            <input
              type="file"
              accept={ACCEPT}
              hidden
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onFile(file);
              }}
            />
          </label>
          {fileUrl ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange("")}
              className="text-[13px]"
              style={{ color: "var(--text-tertiary)", background: "transparent", border: "none" }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="text-[13px]" style={{ color: "#c4554d" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

function FileGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M5 2.5h4.2L13 6.3V13a1.5 1.5 0 0 1-1.5 1.5h-6.5A1.5 1.5 0 0 1 3.5 13V4A1.5 1.5 0 0 1 5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.2 2.5V6.3H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
