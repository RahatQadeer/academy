import type { QuestionBankQuestionType } from "@/academy/lib/questionBank/types";

const MARK: Record<
  QuestionBankQuestionType,
  { label: string; bg: string; fg: string }
> = {
  multiple_choice: { label: "MC", bg: "var(--accent-tint)", fg: "var(--accent)" },
  true_false: { label: "T/F", bg: "var(--info-bg)", fg: "var(--info-fg)" },
  exercise: { label: "EX", bg: "var(--surface-soft)", fg: "var(--text-secondary)" },
  assignment: { label: "OA", bg: "#e9e4f3", fg: "var(--module-academy-fg)" },
  other: { label: "OT", bg: "var(--canvas)", fg: "var(--text-secondary)" },
};

export function questionTypeMark(type: QuestionBankQuestionType) {
  return MARK[type] ?? MARK.other;
}

export function QuestionTypeMark({
  type,
  size = "md",
}: {
  type: QuestionBankQuestionType;
  size?: "sm" | "md";
}) {
  const mark = questionTypeMark(type);
  return (
    <span
      aria-hidden
      className={
        size === "sm"
          ? "inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] px-1 text-[9px] font-semibold tracking-[0.02em]"
          : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[10px] font-semibold tracking-[0.03em]"
      }
      style={{
        background: mark.bg,
        color: mark.fg,
        boxShadow: size === "md" ? "inset 0 0 0 1px color-mix(in srgb, currentColor 12%, transparent)" : undefined,
      }}
    >
      {mark.label}
    </span>
  );
}

export function CourseMark({ name }: { name: string }) {
  const letter = (name.trim()[0] ?? "Q").toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold"
      style={{
        background: "#e9e4f3",
        color: "var(--module-academy-fg)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--module-academy-fg) 12%, transparent)",
      }}
    >
      {letter}
    </span>
  );
}
