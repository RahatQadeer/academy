import { cn } from "@/base/lib/cn";
import { pcType } from "@/partner-center/lib/typography";
import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string | boolean | null;
  labelAction?: React.ReactNode;
};

export function Select({
  label,
  hint,
  error,
  labelAction,
  id,
  className,
  children,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;
  const message = typeof error === "string" ? error : null;
  const describedBy = message
    ? `${selectId}-error`
    : hint
      ? `${selectId}-hint`
      : undefined;

  return (
    <div className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label
          htmlFor={selectId}
          className={cn("block", pcType.label)}
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </label>
        {labelAction}
      </div>
      <span className="relative block">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full appearance-none rounded-[10px] border bg-surface py-[10px] pl-3 pr-10 leading-[1.4] text-ink transition-shadow",
            "hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]",
            pcType.controlInput,
            error
              ? "border-[var(--danger-border)]"
              : "border-line-strong",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={15}
          strokeWidth={2}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-tertiary)" }}
        />
      </span>
      {message ? (
        <span
          id={`${selectId}-error`}
          role="alert"
          className={cn("mt-1.5 block", pcType.label)}
          style={{ color: "var(--danger-fg)" }}
        >
          {message}
        </span>
      ) : hint ? (
        <span
          id={`${selectId}-hint`}
          className={cn("mt-1 block", pcType.label)}
          style={{ color: "var(--text-tertiary)" }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
