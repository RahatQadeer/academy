import type { LearnerQuizOption } from "../types";

export function QuizOptions({
  name,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string;
  options: LearnerQuizOption[];
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 space-y-2" role="radiogroup" aria-label="Answers">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-3 rounded-[6px] px-3 py-2.5"
            style={{
              border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: selected ? "var(--accent-tint-mid)" : "var(--surface)",
              opacity: disabled ? 0.7 : 1,
              cursor: disabled ? "default" : "pointer",
            }}
          >
            <input
              type="radio"
              className="mt-1"
              name={name}
              value={option.id}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.id)}
            />
            <span className="text-[14px] leading-relaxed">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
