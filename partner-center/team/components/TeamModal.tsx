"use client";

import type { ReactNode } from "react";

export function TeamModal({
  title,
  description,
  onClose,
  children,
  footer,
  width = 440,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  width?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(55,53,47,.45)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full rounded-[10px] bg-white p-7 shadow-[0_12px_40px_rgba(15,15,15,.18)]"
        style={{ maxWidth: width }}
      >
        <h2
          id="team-modal-title"
          className="m-0 text-[18px] font-bold leading-tight"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h2>
        {description ? (
          <p
            className="mt-1.5 mb-0 text-[13.5px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {description}
          </p>
        ) : null}
        <div className="mt-5 space-y-4">{children}</div>
        <div className="mt-6 flex items-center justify-end gap-2.5">{footer}</div>
      </div>
    </div>
  );
}
