"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/base/lib/cn";
import { EyeIcon, EyeOffIcon } from "@/base/components/AuthIcons";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  type?: string;
  /**
   * A mark inside the field, before the text. Optional: most of the product's
   * forms are dense grids where an icon per field would be noise, and only the
   * sign-in screens ask for them.
   */
  icon?: ReactNode;
  /**
   * Turns the field red and prints the reason under it.
   *
   * `true` marks it without a message, for the case where two fields are both
   * suspect and only one sentence should be said — a rejected sign-in marks
   * the email and the password, and says why once.
   */
  error?: string | boolean | null;
  /**
   * Adds the show/hide control to a password field.
   *
   * Not automatic on `type="password"`: a password confirmation is often
   * better left masked, and the choice belongs to the screen rather than to
   * the type attribute.
   */
  revealable?: boolean;
  /** Right of the label, where sign-in puts "Forgot password?". */
  labelAction?: ReactNode;
  /**
   * Keeps the label for screen readers but takes it off the screen, the way
   * `Textarea` already does. For a screen that draws the question itself and
   * needs the control under it rather than a second, quieter caption — the
   * portal's form detail, where the question is the loudest thing on the row.
   */
  labelHidden?: boolean;
};

export function Input({
  label,
  hint,
  icon,
  error,
  revealable,
  labelAction,
  labelHidden,
  id,
  type = "text",
  className,
  ...props
}: InputProps) {
  const generated = useId();
  const inputId = id ?? props.name ?? generated;
  const [revealed, setRevealed] = useState(false);

  const message = typeof error === "string" ? error : null;
  const describedBy = message ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="block">
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          labelHidden && !labelAction ? undefined : "mb-1.5",
        )}
      >
        <label
          htmlFor={inputId}
          // Not one of the 221 labels in the reference is uppercase, and none
          // carries letter-spacing: 12.5px medium at .5, 6px above the control.
          className={labelHidden ? "sr-only" : "block text-[12.5px] font-medium"}
          style={labelHidden ? undefined : { color: "var(--text-tertiary)" }}
        >
          {label}
        </label>
        {labelAction}
      </div>

      {/* `group` so the icon can follow the field's own focus rather than
          needing state for something CSS already knows. */}
      <div className="group relative">
        {icon ? (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: error ? "var(--danger-fg)" : "var(--text-quiet)" }}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}

        <input
          id={inputId}
          type={revealable && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-control border bg-surface py-[9px] text-[14.5px] text-ink outline-none placeholder:text-[var(--text-disabled)]",
            "transition-[border-color,box-shadow] duration-150",
            icon ? "pl-9" : "pl-3",
            revealable ? "pr-10" : "pr-3",
            error
              ? "border-[var(--danger-border)] focus:border-[var(--danger-fg)] focus:shadow-[0_0_0_3px_var(--danger-bg)]"
              : "border-line-strong hover:border-[var(--text-quiet)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]",
            className,
          )}
          {...props}
        />

        {revealable ? (
          <button
            type="button"
            onClick={() => setRevealed((on) => !on)}
            // Tab order runs label to label; reaching for the eye with the
            // keyboard from inside the password field would otherwise land
            // here before the next field.
            tabIndex={-1}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[5px] transition-colors hover:bg-[var(--surface-soft)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </div>

      {message ? (
        <span
          id={`${inputId}-error`}
          role="alert"
          className="mt-1.5 block text-[12px]"
          style={{ color: "var(--danger-fg)" }}
        >
          {message}
        </span>
      ) : hint ? (
        <span
          id={`${inputId}-hint`}
          className="mt-1 block text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
