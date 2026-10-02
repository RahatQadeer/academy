function Chevron({ down }: { down?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d={down ? "M2.5 4.2L6 7.8l3.5-3.6" : "M2.5 7.8L6 4.2l3.5 3.6"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReorderButtons({
  label,
  disabled,
  isFirst,
  isLast,
  onUp,
  onDown,
}: {
  label: string;
  disabled?: boolean;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover/module:opacity-100 group-hover/lesson:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={disabled || isFirst}
        className="rounded-[4px] p-0.5 disabled:opacity-25"
        style={{ color: "var(--text-tertiary)" }}
        onClick={onUp}
      >
        <Chevron />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={disabled || isLast}
        className="rounded-[4px] p-0.5 disabled:opacity-25"
        style={{ color: "var(--text-tertiary)" }}
        onClick={onDown}
      >
        <Chevron down />
      </button>
    </div>
  );
}
