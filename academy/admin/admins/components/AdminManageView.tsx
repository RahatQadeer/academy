"use client";

import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import type { AcademyAdminDetail } from "../services/loadAdminDetail";
import { AdminRoleButton } from "./AdminRoleButton";
import {
  StaffActivityExplore,
  assignmentListNodes,
  personListNodes,
  programListNodes,
  publishRequestListNodes,
} from "@/academy/admin/components/StaffActivityExplore";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

function formatSince(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    date,
  );
}

export function AdminManageView({
  detail,
  canRevoke,
}: {
  detail: AcademyAdminDetail;
  canRevoke: boolean;
}) {
  const active = detail.membershipStatus === "active";
  const since = formatSince(detail.grantedAt);
  const { metrics } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/academy/admin/admins"
        className="inline-block text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
      >
        ← Admins
      </Link>

      <div
        className="flex flex-col gap-4 rounded-[14px] bg-surface px-5 py-5 sm:flex-row sm:items-center sm:px-6"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <Avatar name={detail.displayName} size={56} tone="blue" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-bold tracking-[-0.45px] sm:text-[28px]">
              {detail.displayName}
            </h1>
            <Pill tone={active ? "success" : "warning"}>{active ? "Active" : "Suspended"}</Pill>
          </div>
          {detail.email ? (
            <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              {detail.email}
            </p>
          ) : null}
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Academy Admin
            {since ? ` · since ${since}` : ""}
          </p>
        </div>
        <div className="sm:text-right">
          {detail.membershipStatus === "suspended" ? (
            <AdminRoleButton userId={detail.userId} action="reactivate" />
          ) : canRevoke ? (
            <AdminRoleButton userId={detail.userId} action="revoke" />
          ) : (
            <p className="max-w-[220px] text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              At least one active Admin is required.
            </p>
          )}
        </div>
      </div>

      <StaffActivityExplore
        compact
        title="Activity"
        defaultKey="courses"
        metrics={[
          {
            key: "courses",
            label: "Courses",
            value: metrics.coursesCreated,
            detail: "Programs they authored",
          },
          {
            key: "accepted",
            label: "Accepted",
            value: metrics.approvalsAccepted,
            detail: "Publish requests approved",
          },
          {
            key: "returned",
            label: "Returned",
            value: metrics.approvalsReturned,
            detail: "Publish requests returned",
          },
          {
            key: "granted",
            label: "Granted",
            value: metrics.instructorsGranted,
            detail: "Instructor roles they granted",
          },
          {
            key: "revoked",
            label: "Revoked",
            value: metrics.instructorsRevoked,
            detail: "Instructor access they removed",
          },
          {
            key: "assignments",
            label: "Assigned",
            value: metrics.assignmentsMade,
            detail: "Instructor program scopes set",
          },
        ]}
        panels={{
          courses: {
            heading: "Programs created",
            description: "Courses this Admin authored in Academy.",
            empty: "No programs created yet.",
            items: programListNodes(detail.programs, true),
          },
          accepted: {
            heading: "Approvals accepted",
            description: "Publish requests this Admin approved.",
            empty: "No approvals accepted yet.",
            items: publishRequestListNodes(detail.approvalsAccepted, true),
          },
          returned: {
            heading: "Approvals returned",
            description: "Publish requests this Admin returned.",
            empty: "No approvals returned yet.",
            items: publishRequestListNodes(detail.approvalsReturned, true),
          },
          granted: {
            heading: "Instructors granted",
            description: "People this Admin granted Instructor access.",
            empty: "No instructors granted yet.",
            items: personListNodes(detail.instructorsGranted, undefined, true),
          },
          revoked: {
            heading: "Instructors revoked",
            description: "Instructor access this Admin removed.",
            empty: "No instructor revokes recorded yet.",
            items: personListNodes(detail.instructorsRevoked, undefined, true),
          },
          assignments: {
            heading: "Program assignments",
            description: "Programs this Admin assigned to instructors.",
            empty: "No program assignments yet.",
            items: assignmentListNodes(detail.assignments, true),
          },
        }}
      />
    </div>
  );
}
