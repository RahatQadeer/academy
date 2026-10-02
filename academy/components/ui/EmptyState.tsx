import { cn } from "@/base/lib/cn";

/**
 * Academy empty state. Always says what the surface is for and what to do next —
 * an empty screen should never read like a failure.
 */
export function EmptyState({
  icon,
  title,
  body,
  actions,
  compact = false,
  flush = false,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  actions?: React.ReactNode;
  compact?: boolean;
  flush?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        compact ? "py-10" : "py-14",
        !flush && "rounded-[12px] border border-line bg-surface",
        className,
      )}
    >
      {icon ? (
        <div
          className="mb-5 flex h-[48px] w-[48px] items-center justify-center rounded-[10px]"
          style={{ background: "var(--accent-tint)" }}
        >
          <span style={{ color: "var(--accent)" }}>{icon}</span>
        </div>
      ) : null}
      <h3
        className="text-[16px] font-semibold tracking-[-0.2px] text-pretty"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </h3>
      {body ? (
        <p
          className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-pretty"
          style={{ color: "var(--text-secondary)" }}
        >
          {body}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
