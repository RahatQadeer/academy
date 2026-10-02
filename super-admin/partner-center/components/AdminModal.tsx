"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/base/lib/cn";
import { pcType } from "@/super-admin/partner-center/lib/typography";

export function AdminModal({
  title,
  children,
  footer,
  onClose,
  pending,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  pending?: boolean;
}) {
  const titleId = useId();
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
        className="w-full max-w-md rounded-[10px] border bg-surface p-5 shadow-float"
        style={{ borderColor: "var(--border)" }}
      >
        <h2
          id={titleId}
          className={cn(pcType.title, "font-semibold")}
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h2>
        <div className="mt-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

export function AdminModalCancelButton({
  onClose,
  pending,
  innerRef,
}: {
  onClose: () => void;
  pending?: boolean;
  innerRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={onClose}
      disabled={pending}
      className={cn(
        "rounded-[6px] border px-3.5 py-2 transition-colors hover:bg-surface-soft disabled:opacity-40",
        pcType.control,
      )}
      style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
    >
      Cancel
    </button>
  );
}
