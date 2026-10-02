import type { EditorQuestionOption } from "../types";
import { MAX_MC_OPTIONS, MIN_MC_OPTIONS, OPTION_LABEL_MAX } from "../types";

export function MultipleChoiceEditor({
  groupName,
  options,
  correctAnswer,
  disabled,
  onChangeOptions,
  onChangeCorrect,
}: {
  groupName: string;
  options: EditorQuestionOption[];
  correctAnswer: string;
  disabled?: boolean;
  onChangeOptions: (options: EditorQuestionOption[]) => void;
  onChangeCorrect: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p
        className="text-[12.5px] font-medium uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Options
      </p>
      {options.map((option, index) => (
        <div key={option.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 sm:w-24">
            <input
              type="radio"
              name={groupName}
              checked={correctAnswer === option.id}
              disabled={disabled}
              onChange={() => onChangeCorrect(option.id)}
            />
            <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Correct
            </span>
          </label>
          <input
            value={option.label}
            maxLength={OPTION_LABEL_MAX}
            disabled={disabled}
            className="min-w-0 flex-1 rounded-[6px] border bg-surface px-3 py-[9px] text-[14.5px] text-ink"
            style={{ borderColor: "var(--border-strong)" }}
            onChange={(event) =>
              onChangeOptions(
                options.map((item) =>
                  item.id === option.id ? { ...item, label: event.target.value } : item,
                ),
              )
            }
          />
          <button
            type="button"
            disabled={disabled || options.length <= MIN_MC_OPTIONS}
            className="text-[12.5px] disabled:opacity-30"
            style={{ color: "var(--text-secondary)" }}
            onClick={() => {
              const next = options.filter((item) => item.id !== option.id);
              onChangeOptions(next);
              if (correctAnswer === option.id) onChangeCorrect(next[0]?.id ?? "");
            }}
          >
            Remove
          </button>
          <span className="sr-only">Option {index + 1}</span>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled || options.length >= MAX_MC_OPTIONS}
        className="text-[12.5px] disabled:opacity-30"
        style={{ color: "var(--accent)" }}
        onClick={() =>
          onChangeOptions([
            ...options,
            { id: `opt-${Math.random().toString(36).slice(2, 10)}`, label: "" },
          ])
        }
      >
        Add option
      </button>
    </div>
  );
}
