"use client";

/**
 * One select in a filter row, with its "any" option first.
 *
 * Providers had this privately and Contacts needed the same three, so it moved
 * here rather than being written twice — two copies of a control are two
 * chances for a filter row to stop matching the one beside it.
 *
 * Choosing an option applies it. None of the references draw an Apply button
 * beside a filter, and they are right to: a filter that needs a second press
 * before it does anything is a filter somebody has already stopped trusting.
 * The form is still a plain GET form — this asks it to submit rather than
 * routing around it — so the URL stays the state and Back still works.
 */
export function FilterSelect({
  name,
  value,
  all,
  options,
  onPick,
}: {
  name: string;
  value: string;
  all: string;
  options: { value: string; label: string }[];
  /**
   * Told instead of submitting, where the list filters itself.
   *
   * A GET form makes every choice a navigation, and a screen that rebuilds
   * itself before a row moves reads as a filter that does not work. Given
   * this, the caller narrows what it already has and the form is not
   * involved.
   */
  onPick?: (value: string) => void;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      aria-label={all}
      onChange={(event) => {
        if (onPick) {
          onPick(event.currentTarget.value);
          return;
        }
        event.currentTarget.form?.requestSubmit();
      }}
      className="rounded-control border border-line-strong bg-surface px-3 py-2 text-[13.5px]"
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
