import type { ReactNode } from "react";

export function SettingsRow({
  title,
  description,
  control,
  last = false,
}: {
  title: string;
  description: string;
  control: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-start justify-between gap-6 px-5 py-5"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      <div className="min-w-0 max-w-[640px]">
        <p className="text-[15px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
          {title}
        </p>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-pretty" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
