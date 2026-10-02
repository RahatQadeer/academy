"use client";

/**
 * One select in a filter row, with its "any" option first.
 *
 * Choosing an option applies it. A filter that needs a second press before it
 * does anything is a filter somebody has already stopped trusting. The form is
 * still a plain GET form — this asks it to submit rather than routing around it
 * — so the URL stays the state, the Back button works, and a filtered list is
 * a link a client can send to their own team.
 */
export function FilterSelect({
  name,
  value,
  all,
  options,
  className,
}: {
  name: string;
  value: string;
  all: string;
  options: { value: string; label: string }[];
  /** The panel dresses its selects as its own fields; the page keeps these. */
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={all}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={
        className ??
        "rounded-control border border-line-strong bg-surface px-3 py-2 text-[13.5px]"
      }
    >
      <option value="">{all}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
