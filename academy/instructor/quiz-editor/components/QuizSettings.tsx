export function QuizSettings({
  passingScore,
  disabled,
  onChange,
}: {
  passingScore: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <section
      className="rounded-[10px] bg-surface p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <h2 className="text-[13.5px] font-medium">Quiz settings</h2>
      <label className="mt-4 block max-w-xs">
        <span
          className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Passing score (% of 100)
        </span>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          value={passingScore}
          disabled={disabled}
          className="w-full rounded-[6px] border bg-surface px-3 py-[9px] text-[14.5px] text-ink"
          style={{ borderColor: "var(--border-strong)" }}
          title="Maximum 100"
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              onChange(0);
              return;
            }
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            onChange(Math.min(100, Math.max(0, Math.round(n))));
          }}
        />
        <span className="mt-1.5 block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Learners pass at this percent. Cannot be higher than 100.
        </span>
      </label>
    </section>
  );
}
