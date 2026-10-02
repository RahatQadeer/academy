import { cn } from "@/base/lib/cn";
import { pcType } from "@/partner-center/lib/typography";
import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string | boolean | null;
  labelAction?: React.ReactNode;
};

export function Textarea({
  label,
  hint,
  error,
  labelAction,
  id,
  className,
  ...props
}: TextareaProps) {
  const textareaId = id ?? props.name;
  const message = typeof error === "string" ? error : null;
  const describedBy = message
    ? `${textareaId}-error`
    : hint
      ? `${textareaId}-hint`
      : undefined;

  return (
    <div className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label
          htmlFor={textareaId}
          className={cn("block", pcType.label)}
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </label>
        {labelAction}
      </div>
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-[108px] w-full resize-y rounded-control border bg-surface px-3 py-[9px] text-ink placeholder:text-[rgba(55,53,47,0.35)]",
          pcType.controlInput,
          error
            ? "border-[var(--danger-border)] focus:border-[var(--danger-fg)]"
            : "border-line-strong",
          className,
        )}
        {...props}
      />
      {message ? (
        <span
          id={`${textareaId}-error`}
          role="alert"
          className={cn("mt-1.5 block", pcType.label)}
          style={{ color: "var(--danger-fg)" }}
        >
          {message}
        </span>
      ) : hint ? (
        <span
          id={`${textareaId}-hint`}
          className={cn("mt-1 block", pcType.label)}
          style={{ color: "var(--text-tertiary)" }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
