"use client";

import { useRef, useState } from "react";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Optional logo upload (SRS §4.2.6), matching the Figma's dashed panel.
 *
 * The real <input type="file"> is hidden and driven by the styled button, so
 * the panel looks exactly like the design while the file still travels with
 * the form to the server action.
 */
export function LogoPicker({ currentUrl = null }: { currentUrl?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tooLarge, setTooLarge] = useState(false);

  const shown = preview ?? currentUrl;
  const caption = tooLarge
    ? "That file is over 2MB, choose a smaller one."
    : fileName
      ? fileName
      : currentUrl
        ? "Current logo"
        : "PNG or SVG, up to 2MB";

  /** Replaces the preview and releases the previous object URL. */
  function showPreview(file: File | null) {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    /* Tighter: an optional logo does not need the tallest panel on the card,
       and this step has to stand on one screen. */
    <div
      className="flex items-center gap-3 rounded-[10px] px-3.5 py-2.5"
      style={{ border: "1px dashed var(--border-dashed)", background: "var(--surface-subtle)" }}
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt=""
          className="h-9 w-9 shrink-0 rounded-[8px] border border-line object-cover"
        />
      ) : (
        <span
          className="h-9 w-9 shrink-0 rounded-[8px]"
          style={{ background: "var(--surface-soft)" }}
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">
          Upload logo{" "}
          <span className="font-normal" style={{ color: "var(--text-tertiary)" }}>
            (optional)
          </span>
        </div>
        <div
          className="truncate text-[12px]"
          style={{ color: tooLarge ? "var(--danger-fg)" : "var(--text-tertiary)" }}
        >
          {caption}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="logo"
        accept="image/png,image/svg+xml,image/jpeg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            setFileName(null);
            setTooLarge(false);
            showPreview(null);
            return;
          }
          if (file.size > MAX_BYTES) {
            setTooLarge(true);
            setFileName(null);
            showPreview(null);
            event.target.value = "";
            return;
          }
          setTooLarge(false);
          setFileName(file.name);
          showPreview(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-control border border-line-strong bg-surface px-3.5 py-[7px] text-[13px] font-medium"
      >
        Choose file
      </button>
    </div>
  );
}
