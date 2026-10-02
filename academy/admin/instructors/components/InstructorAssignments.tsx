import { programTypeLabel } from "@/academy/lib/domain";
import { formatInstructorDate, permissionLabel, programStatusLabel } from "@/academy/instructor/utils/labels";
import type { InstructorAssignmentItem } from "../types";
import { AssignmentEmptyState } from "./AssignmentEmptyState";
import { RevokeAssignmentButton } from "./RevokeAssignmentButton";

export function InstructorAssignments({ assignments }: { assignments: InstructorAssignmentItem[] }) {
  if (assignments.length === 0) {
    return <AssignmentEmptyState kind="assignments" />;
  }

  return (
    <section className="space-y-3">
      {assignments.map((item) => (
        <article
          key={item.id}
          className="flex flex-col gap-3 rounded-[10px] bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium leading-snug text-pretty">{item.programName}</h3>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {item.category.trim() || programTypeLabel(item.programType)} ·{" "}
              {programStatusLabel(item.programStatus)} · {permissionLabel(item.permission)}
              {item.canPublishWithoutApproval ? " · Direct publish" : ""}
            </p>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Assigned {formatInstructorDate(item.createdAt)}
            </p>
          </div>
          <RevokeAssignmentButton assignmentId={item.id} />
        </article>
      ))}
    </section>
  );
}
