"use client";

import { useRouter } from "next/navigation";
import type { InstructorReviewFilterOptions, InstructorReviewStatusFilter } from "../types";
import { reviewsQueueHref } from "../utils/href";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const fieldClass =
  "h-9 w-full rounded-[8px] border border-line-strong bg-surface px-3 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[rgba(55,53,47,0.35)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]";

export function ReviewFilters({
  filters,
  searchParams,
}: {
  filters: InstructorReviewFilterOptions;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const router = useRouter();
  const status = (firstValue(searchParams.status) || "submitted") as InstructorReviewStatusFilter;
  const programId = firstValue(searchParams.programId);
  const assignmentId = firstValue(searchParams.assignmentId);
  const learner = firstValue(searchParams.learner);
  const assignments = programId
    ? filters.assignments.filter((item) => item.programId === programId)
    : filters.assignments;

  function go(next: Partial<{ status: string; programId: string; assignmentId: string; learner: string }>) {
    router.push(
      reviewsQueueHref({
        status,
        programId,
        assignmentId,
        learner,
        ...next,
      }),
    );
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        go({ learner: String(form.get("learner") ?? "") });
      }}
    >
      <FilterSelect
        label="Course"
        value={programId}
        placeholder="All courses"
        onChange={(value) => go({ programId: value, assignmentId: "" })}
        options={[
          { value: "", label: "All courses" },
          ...filters.programs.map((program) => ({ value: program.id, label: program.name })),
        ]}
      />

      <FilterSelect
        label="Assignment"
        value={assignmentId}
        placeholder="All assignments"
        onChange={(value) => go({ assignmentId: value })}
        options={[
          { value: "", label: "All assignments" },
          ...assignments.map((assignment) => ({ value: assignment.id, label: assignment.title })),
        ]}
      />

      <label className="block min-w-0">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
          Learner
        </span>
        <input
          name="learner"
          defaultValue={learner}
          placeholder="Search name or email"
          className={fieldClass}
          onBlur={(event) => {
            if (event.target.value.trim() !== learner.trim()) {
              go({ learner: event.target.value });
            }
          }}
        />
      </label>
    </form>
  );
}
