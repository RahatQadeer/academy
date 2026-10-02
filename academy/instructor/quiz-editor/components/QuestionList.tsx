import type { EditorQuestion } from "../types";

export function QuestionList({
  questions,
  selectedKey,
  disabled,
  onSelect,
  onMove,
  onRemove,
}: {
  questions: (EditorQuestion & { clientKey: string })[];
  selectedKey: string | null;
  disabled?: boolean;
  onSelect: (key: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (key: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <ul className="space-y-1">
      {questions.map((question, index) => {
        const selected = question.clientKey === selectedKey;
        return (
          <li key={question.clientKey} className="flex items-center gap-1">
            <button
              type="button"
              className="min-w-0 flex-1 rounded-[6px] px-2 py-1.5 text-left text-[13px]"
              style={{
                background: selected ? "var(--module-academy-bg)" : "transparent",
                color: selected ? "var(--module-academy-fg)" : "inherit",
              }}
              onClick={() => onSelect(question.clientKey)}
            >
              <span className="block truncate">
                {index + 1}. {question.questionText.trim() || "Untitled question"}
              </span>
              <span className="block text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                {question.type === "true_false" ? "True / False" : "Multiple choice"}
              </span>
            </button>
            <button
              type="button"
              aria-label="Move question up"
              disabled={disabled || index === 0}
              className="rounded-[4px] px-1 text-[12px] disabled:opacity-30"
              onClick={() => onMove(index, index - 1)}
            >
              Up
            </button>
            <button
              type="button"
              aria-label="Move question down"
              disabled={disabled || index === questions.length - 1}
              className="rounded-[4px] px-1 text-[12px] disabled:opacity-30"
              onClick={() => onMove(index, index + 1)}
            >
              Down
            </button>
            <button
              type="button"
              aria-label="Remove question"
              disabled={disabled}
              className="rounded-[4px] px-1 text-[12px] disabled:opacity-30"
              style={{ color: "var(--text-secondary)" }}
              onClick={() => onRemove(question.clientKey)}
            >
              Remove
            </button>
          </li>
        );
      })}
    </ul>
  );
}
