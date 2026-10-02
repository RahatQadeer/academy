"use client";

import { useEffect, useState } from "react";
import { cn } from "@/base/lib/cn";
import type {
  QuestionBankFilterOptions,
  QuestionBankFilters as QuestionBankFilterState,
} from "@/academy/lib/questionBank/types";
import { hasQuestionBankActiveFilters } from "@/academy/lib/questionBank/filters";
import { questionBankTypeLabel } from "@/academy/lib/questionBank/types";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";

function shortCourseName(name: string) {
  const cut = name.split(":")[0]?.trim();
  return cut && cut.length < name.length ? cut : name;
}

export function QuestionBankFiltersBar({
  options,
  filters,
  pending,
  onChange,
}: {
  options: QuestionBankFilterOptions;
  filters: QuestionBankFilterState;
  pending?: boolean;
  onChange: (next: Partial<QuestionBankFilterState>) => void;
}) {
  const [search, setSearch] = useState(filters.search);
  const courseSelected = Boolean(filters.programId);
  const modules = courseSelected
    ? options.modules.filter((item) => item.programId === filters.programId)
    : [];
  const active = hasQuestionBankActiveFilters(filters);
  const programName = options.programs.find((item) => item.id === filters.programId)?.name;
  const moduleName = options.modules.find((item) => item.id === filters.moduleId)?.title;

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  return (
    <div className={cn("flex flex-col gap-4", pending && "opacity-90")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div
          className="grid w-full grid-cols-2 gap-0.5 rounded-[10px] p-0.5 lg:w-[20rem] lg:shrink-0"
          style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--border-strong)" }}
        >
          <StatusTab
            label="Library"
            active={filters.status !== "custom"}
            disabled={pending && filters.status !== "custom"}
            onClick={() => {
              if (filters.status === "in_quiz" || filters.status === "all") return;
              onChange({ status: "in_quiz" });
            }}
          />
          <StatusTab
            label="Saved for later"
            active={filters.status === "custom"}
            disabled={pending && filters.status === "custom"}
            onClick={() => {
              if (filters.status === "custom") return;
              onChange({ status: "custom", moduleId: "" });
            }}
          />
        </div>

        <form
          className="min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ search });
          }}
        >
          <label className="block">
            <span className="sr-only">Search questions</span>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-tertiary)" }}
              >
                <SearchIcon />
              </span>
              <input
                name="q"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search question, lesson, or course"
                className="h-10 w-full rounded-[10px] border bg-surface pr-[5.5rem] pl-10 text-[14px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[rgba(55,53,47,0.35)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]"
                style={{ borderColor: "var(--border-strong)" }}
              />
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      onChange({ search: "" });
                    }}
                    aria-label="Clear search"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border-0 hover:bg-[var(--surface-soft)]"
                    style={{ color: "var(--text-tertiary)", background: "transparent" }}
                  >
                    <ClearIcon />
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="inline-flex h-7 items-center rounded-[7px] border-0 px-2.5 text-[12px] font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  Search
                </button>
              </div>
            </div>
          </label>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <FilterSelect
          label="Course"
          value={filters.programId}
          onChange={(programId) => onChange({ programId, moduleId: "" })}
          options={[
            { value: "", label: "All courses" },
            ...options.programs.map((program) => ({
              value: program.id,
              label: shortCourseName(program.name),
              hint:
                typeof program.questionCount === "number"
                  ? String(program.questionCount)
                  : undefined,
            })),
          ]}
        />
        <FilterSelect
          label="Module"
          value={filters.moduleId}
          disabled={!courseSelected || modules.length === 0 || filters.status === "custom"}
          onChange={(moduleId) => onChange({ moduleId })}
          options={[
            {
              value: "",
              label:
                filters.status === "custom"
                  ? "Saved-for-later questions are not in a module"
                  : !courseSelected
                    ? "Select a course first"
                    : modules.length === 0
                      ? "No modules"
                      : "All modules",
            },
            ...modules.map((module) => ({
              value: module.id,
              label: module.title,
            })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={filters.type}
          onChange={(type) => onChange({ type: type as QuestionBankFilterState["type"] })}
          options={[
            { value: "all", label: "All types" },
            { value: "multiple_choice", label: "Multiple choice" },
            { value: "true_false", label: "True / false" },
            { value: "exercise", label: "Lesson exercise" },
            { value: "assignment", label: "Open answer" },
            { value: "other", label: "Other" },
          ]}
        />
      </div>

      {active ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="mr-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Filtered
          </span>
          {filters.programId && programName ? (
            <FilterChip
              label={shortCourseName(programName)}
              onRemove={() => onChange({ programId: "", moduleId: "" })}
            />
          ) : null}
          {filters.moduleId && moduleName ? (
            <FilterChip label={moduleName} onRemove={() => onChange({ moduleId: "" })} />
          ) : null}
          {filters.type !== "all" ? (
            <FilterChip
              label={questionBankTypeLabel(filters.type)}
              onRemove={() => onChange({ type: "all" })}
            />
          ) : null}
          {filters.search.trim() ? (
            <FilterChip
              label={`“${filters.search.trim()}”`}
              onRemove={() => onChange({ search: "" })}
            />
          ) : null}
          <button
            type="button"
            onClick={() =>
              onChange({
                search: "",
                type: "all",
                programId: "",
                moduleId: "",
                status: "custom",
              })
            }
            className="ml-1 text-[12.5px] font-medium hover:text-accent-hover"
            style={{ color: "var(--accent)", background: "transparent", border: 0, padding: 0 }}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use QuestionBankFiltersBar */
export const QuestionBankFilters = QuestionBankFiltersBar;

function StatusTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="inline-flex h-9 items-center justify-center rounded-[8px] border-0 px-2.5 text-[12.5px] font-medium transition-[background-color,color,transform] duration-150 disabled:cursor-default sm:px-3 sm:text-[13px]"
      style={{
        background: active ? "var(--ink)" : "transparent",
        color: active ? "#fff" : "var(--text-secondary)",
      }}
    >
      {label}
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium hover:bg-[var(--canvas)] sm:max-w-[28rem]"
      style={{
        color: "var(--text-secondary)",
        background: "var(--surface)",
        borderColor: "var(--border-strong)",
      }}
      title={`Remove ${label}`}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden className="shrink-0 opacity-45">
        ×
      </span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QuestionBankPagination({
  filters,
  page,
  pageCount,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
}: {
  filters?: QuestionBankFilterState;
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
}) {
  void filters;
  return (
    <PaginationBar
      page={page}
      pageCount={pageCount}
      total={total}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      itemLabel="questions"
      label="Question bank pages"
      onPageChange={onPageChange}
    />
  );
}
