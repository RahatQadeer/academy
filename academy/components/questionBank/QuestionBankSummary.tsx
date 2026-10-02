"use client";

import type { QuestionBankFilters, QuestionBankQuestionType, QuestionBankSummary } from "@/academy/lib/questionBank/types";

const TYPE_CHIPS: {
  key: QuestionBankQuestionType;
  count: (summary: QuestionBankSummary) => number;
  label: string;
}[] = [
  { key: "multiple_choice", count: (summary) => summary.multipleChoice, label: "MCQ" },
  { key: "true_false", count: (summary) => summary.trueFalse, label: "T/F" },
  { key: "exercise", count: (summary) => summary.exercise ?? 0, label: "Exercise" },
  { key: "assignment", count: (summary) => summary.assignment ?? 0, label: "Open" },
  { key: "other", count: (summary) => summary.other ?? 0, label: "Other" },
];

export function QuestionBankSummaryLine({
  filters,
  summary,
  onChange,
}: {
  filters: QuestionBankFilters;
  summary: QuestionBankSummary;
  onChange: (next: Partial<QuestionBankFilters>) => void;
}) {
  if (summary.total === 0) return null;

  const chips = TYPE_CHIPS.map((chip) => ({
    ...chip,
    value: chip.count(summary),
  })).filter((chip) => chip.value > 0);

  return (
    <div className="mt-5 flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[13px] leading-none" style={{ color: "var(--text-tertiary)" }}>
          <span
            className="text-[28px] font-semibold tracking-[-0.6px] tabular-nums"
            style={{ color: "var(--ink)" }}
          >
            {summary.total.toLocaleString()}
          </span>
          <span className="ml-2">question{summary.total === 1 ? "" : "s"}</span>
        </p>
        <span className="hidden h-4 w-px sm:block" style={{ background: "var(--border-strong)" }} aria-hidden />
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          <span className="font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {summary.programCount.toLocaleString()}
          </span>{" "}
          course{summary.programCount === 1 ? "" : "s"}
        </p>
      </div>

      {(summary.custom ?? 0) > 0 || chips.length > 0 ? (
        <ul
          className="flex flex-wrap gap-1.5 rounded-[12px] p-1.5"
          style={{
            background: "var(--surface-soft)",
            boxShadow: "inset 0 0 0 1px var(--border)",
          }}
        >
          {(summary.custom ?? 0) > 0 ? (
            <li>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    status: filters.status === "custom" ? "in_quiz" : "custom",
                    moduleId: "",
                    page: 1,
                  })
                }
                aria-pressed={filters.status === "custom"}
                title={
                  filters.status === "custom"
                    ? "Show course library"
                    : "Show questions saved for later only"
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border-0 px-2.5 text-[12px] font-medium transition-colors"
                style={
                  filters.status === "custom"
                    ? {
                        background: "var(--surface)",
                        color: "var(--module-academy-fg)",
                        boxShadow: "0 1px 2px rgba(15,15,15,.06)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--text-secondary)",
                      }
                }
              >
                <span className="tabular-nums font-semibold">{summary.custom.toLocaleString()}</span>
                Saved for later
              </button>
            </li>
          ) : null}
          {chips.map((chip) => {
            const active = filters.type === chip.key;
            return (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      type: active ? "all" : chip.key,
                      page: 1,
                    })
                  }
                  aria-pressed={active}
                  title={active ? `Clear ${chip.label} filter` : `Show ${chip.label} only`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border-0 px-2.5 text-[12px] font-medium transition-colors"
                  style={
                    active
                      ? {
                          background: "var(--surface)",
                          color: "var(--accent)",
                          boxShadow: "0 1px 2px rgba(15,15,15,.06)",
                        }
                      : {
                          background: "transparent",
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  <span className="tabular-nums font-semibold">{chip.value.toLocaleString()}</span>
                  <span style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}>
                    {chip.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
