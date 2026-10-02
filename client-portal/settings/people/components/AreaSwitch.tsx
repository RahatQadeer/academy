/**
 * One area, as a switch.
 *
 * A real `<input type="checkbox" name="areas">` under a CSS-drawn track, rather
 * than the controlled `base/components/Toggle` — that one is a client component
 * holding its state in React and posting nothing. The form here is submitted to
 * a server action that reads `formData.getAll("areas")`, so the checkbox has to
 * be the thing in the form. Styling it with `peer-checked` keeps the whole
 * modal a server component and keeps it working with JavaScript disabled.
 */
export function AreaSwitch({
  value,
  label,
  hint,
  defaultChecked = false,
}: {
  value: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px]">{label}</span>
        {hint ? (
          <span
            className="block text-[12.5px] leading-snug"
            style={{ color: "var(--text-tertiary)" }}
          >
            {hint}
          </span>
        ) : null}
      </span>

      <input
        type="checkbox"
        name="areas"
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />

      {/* The track. `peer-checked:[&>span]:` reaches the knob, which is a child
          of this sibling rather than a sibling itself, so a plain
          `peer-checked:` on the knob would never match. */}
      <span
        aria-hidden
        className="relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full bg-[#e0e0dd] transition-colors peer-checked:bg-[var(--accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] peer-checked:[&>span]:translate-x-[14px]"
      >
        <span
          className="ml-[2px] block h-[16px] w-[16px] rounded-full bg-white transition-transform"
          style={{ boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .16)" }}
        />
      </span>
    </label>
  );
}
