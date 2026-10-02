"use client";

import { useEffect, useId, useRef } from "react";

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  pending,
  destructive = true,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-md rounded-[10px] border bg-surface p-5 shadow-float"
        style={{ borderColor: "var(--border)" }}
      >
        <h2
          id={titleId}
          className="text-[16px] font-semibold tracking-[-0.2px]"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h2>
        <p
          id={bodyId}
          className="mt-2 text-[13.5px] leading-relaxed text-pretty"
          style={{ color: "var(--text-secondary)" }}
        >
          {body}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-[6px] border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-surface-soft disabled:opacity-40"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-[6px] px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: destructive ? "#a8433b" : "var(--ink)" }}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
