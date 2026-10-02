import type { EditorQuestion } from "../types";
import { QuestionEditor } from "./QuestionEditor";

export function QuestionCard({
  question,
  index,
  groupKey,
  disabled,
  onChange,
}: {
  question: EditorQuestion;
  index: number;
  groupKey: string;
  disabled?: boolean;
  onChange: (patch: Partial<EditorQuestion>) => void;
}) {
  return (
    <section
      className="rounded-[10px] bg-surface p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-[13.5px] font-medium">Question {index + 1}</h2>
        {question.fromBank ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            title="From question bank"
            style={{
              background: "color-mix(in srgb, #c9a227 16%, white)",
              color: "#8a6d12",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M8 1.6l1.76 3.56 3.93.57-2.84 2.77.67 3.91L8 10.56l-3.52 1.85.67-3.91L2.3 5.73l3.93-.57L8 1.6z"
                fill="currentColor"
              />
            </svg>
            Bank
          </span>
        ) : null}
      </div>
      <QuestionEditor
        question={question}
        groupKey={groupKey}
        disabled={disabled}
        onChange={onChange}
      />
    </section>
  );
}
