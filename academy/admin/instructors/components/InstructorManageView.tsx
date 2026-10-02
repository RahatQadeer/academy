"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/base/components/Avatar";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { programTypeLabel } from "@/academy/lib/domain";
import { permissionLabel } from "@/academy/instructor/utils/labels";
import { revokeInstructorRoleAction } from "../actions";
import {
  formatAssignmentCoverage,
  formatInstructorSince,
} from "../lib/formatInstructorDates";
import type { InstructorAssignmentDetail, InstructorAssignmentItem } from "../types";
import {
  StaffActivityExplore,
  programListNodes,
  publishRequestListNodes,
} from "@/academy/admin/components/StaffActivityExplore";
import { AssignInstructorForm } from "./AssignInstructorForm";
import { EditScopeDialog } from "./EditScopeDialog";

function permissionTone(permission: InstructorAssignmentItem["permission"]) {
  return permission === "create" ? ("accent" as const) : ("info" as const);
}

export function InstructorManageView({ detail }: { detail: InstructorAssignmentDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<InstructorAssignmentItem | null>(null);
  const active = detail.membershipStatus === "active";
  const since = formatInstructorSince(detail.grantedAt);

  function removeAccess() {
    if (!window.confirm("Remove instructor access? Assignments are kept but authoring is blocked.")) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await revokeInstructorRoleAction(detail.userId);
      if (!result.ok) {
        setError(result.message || "Access could not be removed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Link
        href="/academy/admin/instructors"
        className="inline-block text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
      >
        ← Instructors
      </Link>

      <div
        className="flex flex-col gap-3 rounded-[12px] bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:px-5"
        style={{ border: "1px solid var(--border)" }}
      >
        <Avatar name={detail.displayName} size={40} tone="tan" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-bold tracking-[-0.3px] sm:text-[22px]">
              {detail.displayName}
            </h1>
            <Pill tone={active ? "success" : "warning"}>{active ? "Active" : "Suspended"}</Pill>
          </div>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {[detail.email, since ? `since ${since}` : null, `${detail.assignments.length} assigned`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={pending || !active}
          onClick={removeAccess}
          style={active ? { color: "var(--danger-fg)" } : undefined}
        >
          {pending ? "Removing…" : "Remove access"}
        </Button>
      </div>
      {error ? (
        <p className="text-[12.5px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}

      <StaffActivityExplore
        compact
        title="Activity"
        defaultKey="courses"
        metrics={[
          {
            key: "courses",
            label: "Courses",
            value: detail.metrics.coursesCreated,
            detail: "Programs authored",
          },
          {
            key: "requests",
            label: "Requests",
            value: detail.metrics.publishRequestsSent,
            detail: "Sent for review",
          },
          {
            key: "pending",
            label: "Pending",
            value: detail.metrics.publishPending,
            detail: "Waiting",
          },
          {
            key: "approved",
            label: "Approved",
            value: detail.metrics.publishApproved,
            detail: "Accepted",
          },
          {
            key: "returned",
            label: "Returned",
            value: detail.metrics.publishReturned,
            detail: "Sent back",
          },
        ]}
        panels={{
          courses: {
            heading: "Programs created",
            description: "Courses this Instructor authored.",
            empty: "No programs created yet.",
            items: programListNodes(detail.createdPrograms, true),
          },
          requests: {
            heading: "Publish requests",
            description: "All requests sent for Admin review.",
            empty: "No publish requests yet.",
            items: publishRequestListNodes(detail.publishRequests, true),
          },
          pending: {
            heading: "Pending",
            description: "Waiting on Admin.",
            empty: "No pending requests.",
            items: publishRequestListNodes(
              detail.publishRequests.filter((row) => row.status === "pending"),
              true,
            ),
          },
          approved: {
            heading: "Approved",
            description: "Accepted by Admin.",
            empty: "No approved requests yet.",
            items: publishRequestListNodes(
              detail.publishRequests.filter((row) => row.status === "approved"),
              true,
            ),
          },
          returned: {
            heading: "Returned",
            description: "Sent back by Admin.",
            empty: "No returned requests.",
            items: publishRequestListNodes(
              detail.publishRequests.filter((row) => row.status === "rejected"),
              true,
            ),
          },
        }}
      />

      <section id="assignments" aria-labelledby="assigned-programs-heading">
        <div
          className="overflow-hidden rounded-[12px] bg-surface"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="flex items-baseline justify-between gap-3 border-b px-4 py-3 sm:px-5"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <h2 id="assigned-programs-heading" className="text-[14px] font-semibold tracking-[-0.2px]">
                Assigned programs
              </h2>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                Scope and permission
              </p>
            </div>
            <p className="text-[11.5px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
              {detail.assignments.length.toLocaleString()}
            </p>
          </div>

          {detail.assignments.length === 0 ? (
            <p className="px-4 py-7 text-center text-[13px] sm:px-5" style={{ color: "var(--text-tertiary)" }}>
              No programs assigned yet.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {detail.assignments.map((item, index) => {
                const coverage = formatAssignmentCoverage(item.moduleIds, item.modules);
                const typeLabel = item.category.trim() || programTypeLabel(item.programType);
                return (
                  <li
                    key={item.id}
                    id={`assign-${item.id}`}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    style={index > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium leading-snug text-pretty">{item.programName}</p>
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        {typeLabel}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Pill tone="neutral">{coverage}</Pill>
                        <Pill tone={permissionTone(item.permission)}>
                          {permissionLabel(item.permission)}
                        </Pill>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="shrink-0 cursor-pointer self-start rounded-[8px] border-none bg-transparent px-2 py-1 text-[12.5px] font-medium text-accent hover:bg-[color:var(--accent-tint)] sm:self-center"
                    >
                      Edit scope
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {active && detail.assignablePrograms.length > 0 ? (
        <div id="assign-new">
          <AssignInstructorForm
            userId={detail.userId}
            programs={detail.assignablePrograms}
            emptyKind="all_assigned"
          />
        </div>
      ) : null}

      {editing ? <EditScopeDialog assignment={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
