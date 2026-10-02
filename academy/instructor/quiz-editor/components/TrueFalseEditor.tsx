import { TRUE_FALSE_OPTIONS } from "../utils/validation";

export function TrueFalseEditor({
  name,
  correctAnswer,
  disabled,
  onChange,
}: {
  name: string;
  correctAnswer: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Correct answer">
      <p
        className="text-[12.5px] font-medium uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Correct answer
      </p>
      {TRUE_FALSE_OPTIONS.map((option) => (
        <label key={option.id} className="flex items-center gap-2 text-[14.5px]">
          <input
            type="radio"
            name={name}
            checked={correctAnswer === option.id}
            disabled={disabled}
            onChange={() => onChange(option.id)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
