import { cn } from "@/base/lib/cn";

/**
 * Label-above-control field used inside Whitby dialogs.
 *
 * Base `Input` is not reused here: it renders an uppercase tracked label and a
 * 14.5px control, while the dialogs use a sentence-case 12.5px label and a 14px
 * control. Both are valid under the design system's ranges.
 */
/**
 * The control without a size on it, for dialogs the reference draws at some
 * other size. Appending `text-[13.5px]` to CONTROL does not work: `cn` only
 * joins strings, and Tailwind emits `.text-[14px]` after `.text-[13.5px]`, so
 * the default wins whatever the caller writes.
 */
export const CONTROL_UNSIZED =
  "w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-ink placeholder:text-[rgba(55,53,47,0.35)]";

export const CONTROL = `${CONTROL_UNSIZED} text-[14px]`;

export function Field({
  label,
  hint,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  /**
   * Draws the asterisk, and says so to a screen reader in words.
   *
   * On the label rather than left to the input's own `required`, because the
   * answer to "must I fill this in" is wanted while reading the form, not
   * after pressing Save and being refused.
   */
  required?: boolean;
  /** Sits inside the label, lighter and unweighted — 5.0a's "(optional …)". */
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[12.5px] font-medium"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
        {required ? (
          <>
            <span aria-hidden style={{ color: "var(--danger-text)" }}>
              {" "}*
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
        {hint ? (
          <span className="font-normal" style={{ color: "var(--text-quiet)" }}>
            {" "}
            {hint}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}
