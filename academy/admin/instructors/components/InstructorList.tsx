import type { AdminInstructorListData } from "../types";
import { AssignmentEmptyState } from "./AssignmentEmptyState";
import { InstructorCard } from "./InstructorCard";

export function InstructorList({ data }: { data: AdminInstructorListData }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[13.5px] font-medium">Active Instructors</h2>
        {data.active.length === 0 ? (
          <AssignmentEmptyState kind="instructors" />
        ) : (
          <div className="space-y-3">
            {data.active.map((item) => (
              <InstructorCard key={item.userId} item={item} />
            ))}
          </div>
        )}
        {data.truncatedActive ? (
          <p className="mt-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Showing the first 48 active Instructors.
          </p>
        ) : null}
      </section>
      <section>
        <h2 className="mb-3 text-[13.5px] font-medium">Suspended Instructors</h2>
        {data.suspended.length === 0 ? (
          <AssignmentEmptyState kind="suspended" />
        ) : (
          <div className="space-y-3">
            {data.suspended.map((item) => (
              <InstructorCard key={item.userId} item={item} />
            ))}
          </div>
        )}
        {data.truncatedSuspended ? (
          <p className="mt-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Showing the first 48 suspended Instructors.
          </p>
        ) : null}
      </section>
    </div>
  );
}
