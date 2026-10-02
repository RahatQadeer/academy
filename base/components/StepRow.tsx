import { cn } from "@/base/lib/cn";

export function StepRow({
  index,
  title,
  detail,
  done,
  active,
  trailing,
}: {
  index: number;
  title: string;
  detail?: string;
  done?: boolean;
  active?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span
        className={cn(
          "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
          done
            ? "bg-[var(--success-bg)] text-[var(--success-fg)]"
            : active
              ? "bg-accent text-white"
              : "border border-line-strong text-[var(--text-tertiary)]",
        )}
      >
        {done ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6.2L4.6 8.8L10 3.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          index
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn("text-[14.5px]", active ? "font-semibold" : "font-medium")}
        >
          {title}
        </div>
        {detail ? (
          <div className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            {detail}
          </div>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
