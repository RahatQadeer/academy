import Link from "next/link";
import type { AdminInstructorListItem } from "../types";
import { InstructorRoleButton } from "./InstructorRoleButton";

export function InstructorCard({ item }: { item: AdminInstructorListItem }) {
  const href = `/academy/admin/instructors/${item.userId}`;
  const countLabel =
    item.assignmentCount === 1 ? "1 program assignment" : `${item.assignmentCount} program assignments`;
  const statusLabel = item.membershipStatus === "active" ? "Active" : "Suspended";

  return (
    <article
      className="flex flex-col gap-3 rounded-[10px] bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="min-w-0">
        <h3 className="text-[16px] font-medium leading-snug text-pretty">{item.displayName}</h3>
        {item.email ? (
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {item.email}
          </p>
        ) : null}
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {statusLabel}
          {" · "}
          {item.assignmentCount === 0 ? "Not assigned" : countLabel}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:items-end">
        <Link
          href={href}
          className="text-[13px] no-underline hover:text-accent-hover"
          style={{ color: "var(--accent)" }}
        >
          {item.membershipStatus === "active" ? "Manage assignments" : "View assignments"}
        </Link>
        <InstructorRoleButton
          userId={item.userId}
          action={item.membershipStatus === "active" ? "revoke" : "reactivate"}
        />
      </div>
    </article>
  );
}
