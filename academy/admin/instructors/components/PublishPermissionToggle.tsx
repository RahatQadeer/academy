"use client";

import { Toggle } from "@/base/components/Toggle";

export function PublishPermissionToggle({
  value,
  disabled,
  onChange,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="rounded-[10px] border px-4 py-3.5"
      style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-[-0.01em]">Publish without approval</p>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            When enabled, this instructor can publish the assigned program directly to Explore without
            submitting for admin review.
          </p>
        </div>
        <Toggle checked={value} disabled={disabled} onChange={onChange} aria-label="Publish without approval" />
      </div>
      {value ? (
        <p className="mt-2.5 text-[12px] font-medium" style={{ color: "var(--success-fg)" }}>
          Direct publish enabled for this assignment
        </p>
      ) : null}
    </div>
  );
}
