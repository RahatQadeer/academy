import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { BUTTON_SIZE } from "./buttons";
import type { SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Sentence case, not uppercase.
 *
 * The note at the top of this file says these match `base/components/Input`,
 * and they stopped doing so: base carries "Not one of the 221 labels in the
 * reference is uppercase, and none carries letter-spacing", and was corrected
 * to 12.5px medium. This was left behind at uppercase with .05em of tracking.
 *
 * It was not a cosmetic difference, because ten screens here use both — New
 * Request, Add a Person, the profile pane, the form detail, both onboarding
 * steps — so a single dialog drew "Title" in sentence case above one field and
 * "DESCRIPTION" in tracked capitals above the next.
 */
const LABEL_CLASS = "block mb-1.5 text-[12.5px] font-medium";

/**
 * Hover and focus as base `Input` draws them — a darker hairline under the
 * pointer, the accent border and a 3px tint ring on focus. These had neither,
 * so the profile pane answered focus on Full name and Phone and sat inert on
 * Salutation and Mailing address directly between them.
 */
const CONTROL_CLASS =
  "w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[14.5px] text-ink outline-none placeholder:text-[var(--text-disabled)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--text-quiet)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]";

/** Matches `@/base/components/Input`, which has no textarea or select variant. */
export function Textarea({
  label,
  labelHidden,
  hint,
  id,
  className,
  wrapperClassName,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  /**
   * Keeps the label for screen readers but takes it off the screen, for a field
   * whose purpose is already obvious from its placeholder and its position — the
   * message composer, where a stacked "REPLY" caption would only add furniture.
   * The label is never simply dropped: the field still has to have a name.
   */
  labelHidden?: boolean;
  hint?: string;
  /** For the wrapping label, so the field can take part in a flex row. */
  wrapperClassName?: string;
}) {
  const fieldId = id ?? props.name;
  return (
    <label className={cn("block", wrapperClassName)} htmlFor={fieldId}>
      <span
        className={labelHidden ? "sr-only" : LABEL_CLASS}
        style={labelHidden ? undefined : { color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <textarea
        id={fieldId}
        rows={props.rows ?? 4}
        className={cn(CONTROL_CLASS, "resize-y leading-relaxed", className)}
        {...props}
      />
      {hint ? (
        <span
          className="mt-1 block text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Select({
  label,
  labelHidden,
  hint,
  options,
  placeholder,
  id,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  /** See `Textarea`'s own note — the caller draws the label itself. */
  labelHidden?: boolean;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const fieldId = id ?? props.name;
  return (
    <label className="block" htmlFor={fieldId}>
      <span
        className={labelHidden ? "sr-only" : LABEL_CLASS}
        style={labelHidden ? undefined : { color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <select id={fieldId} className={cn(CONTROL_CLASS, className)} {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <span
          className="mt-1 block text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/**
 * The fields of a form, stacked — or paired.
 *
 * `cols={2}` puts two short fields on a line above about 640px, which is the
 * difference between a settings pane that fits a laptop screen and one that is
 * seven full-width boxes and a scrollbar. Only where the fields really are
 * short: a full name and a preferred name read as a pair, an address does not
 * halve, and anything that does not belong in a column says so with `Wide`.
 *
 * One column stays the default, because most of what uses this is a dialog
 * about 420px across where two columns would be two cramped ones.
 */
export function FieldGroup({
  children,
  cols = 1,
}: {
  children: React.ReactNode;
  cols?: 1 | 2;
}) {
  return (
    <div className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2")}>{children}</div>
  );
}

/** A field that takes the whole line inside a two-column `FieldGroup`. */
export function Wide({ children }: { children: React.ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}

/**
 * The foot of a form: right-aligned, the way out on the left of the way on.
 *
 * Whitby ends every dialog and settings pane like this — a bordered Cancel,
 * then the primary action at the far right. The portal led with the primary
 * at the left edge and trailed a grey "Cancel" that did not look pressable, so
 * a client moving between the two products found the button they wanted on
 * the other side of the dialog.
 */
export function FormActions({
  children,
  reverse = false,
}: {
  children: React.ReactNode;
  /**
   * Draw the children in the opposite order to the markup, for a form whose
   * primary submit has to come first in the DOM — Enter in a field presses
   * the first submit button, and that must not be Save draft.
   */
  reverse?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-wrap items-center gap-2.5",
        reverse ? "flex-row-reverse justify-start" : "justify-end",
      )}
    >
      {children}
    </div>
  );
}

/** Cancel, or Skip — the secondary half of `FormActions`, as a link. */
export function CancelLink({
  href,
  children = "Cancel",
}: {
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-control border border-line-strong bg-transparent font-medium text-ink no-underline transition-colors hover:bg-surface-soft hover:text-ink",
        BUTTON_SIZE.form,
      )}
    >
      {children}
    </Link>
  );
}
