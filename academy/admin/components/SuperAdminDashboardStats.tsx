import { StatCard, StatGrid } from "@/academy/components/ui";
import type { AdminDashboardData } from "../types";

function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5.2" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 13c.35-2.2 1.8-3.4 3.5-3.4s3.15 1.2 3.5 3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="11.2" cy="6" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.4 13c.2-1.3.85-2.15 1.7-2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2.5l5 1.6v4.4c0 2.8-1.9 4.8-5 5.5-3.1-.7-5-2.7-5-5.5V4.1L8 2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SuspendedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 8h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function InstructorsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2 15 5.5 8 9 1 5.5 8 2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M4 7v3.2c0 1 1.8 2 4 2s4-1 4-2V7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.2 13c.5-2.4 2.2-3.6 4.8-3.6s4.3 1.2 4.8 3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** People-focused stats for Academy Super Admin. */
export function SuperAdminDashboardStats({ data }: { data: AdminDashboardData }) {
  const totalPeople =
    data.learnerCount + data.instructorCount + data.adminCount + data.superAdminCount;

  return (
    <section aria-label="Academy people">
      <StatGrid>
        <StatCard
          value={totalPeople}
          label="Total people"
          detail={`${data.learnerCount.toLocaleString()} learners · ${data.instructorCount.toLocaleString()} instructors · ${data.adminCount.toLocaleString()} admins`}
          icon={<PeopleIcon />}
          tone="info"
          href="/academy/admin/users"
        />
        <StatCard
          value={data.learnerCount}
          label="Learners"
          detail={
            data.suspendedLearnerCount > 0
              ? `${data.suspendedLearnerCount.toLocaleString()} suspended`
              : "Active learner memberships"
          }
          icon={<PeopleIcon />}
          tone="success"
          href="/academy/admin/enrollments"
        />
        <StatCard
          value={data.instructorCount}
          label="Instructors"
          detail={
            data.suspendedInstructorCount > 0
              ? `${data.suspendedInstructorCount.toLocaleString()} suspended`
              : "Active instructors"
          }
          icon={<InstructorsIcon />}
          tone="accent"
          href="/academy/admin/instructors"
        />
        <StatCard
          value={data.adminCount}
          label="Admins"
          detail={
            [
              data.superAdminCount > 0
                ? `${data.superAdminCount.toLocaleString()} super admin${data.superAdminCount === 1 ? "" : "s"}`
                : null,
              data.suspendedAdminCount > 0
                ? `${data.suspendedAdminCount.toLocaleString()} suspended`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Active Academy Admins"
          }
          icon={<AdminIcon />}
          tone="accent"
          href="/academy/admin/admins"
        />
        <StatCard
          value={data.suspendedMembershipTotal}
          label="Suspended"
          detail="Suspended Academy memberships (any role)"
          icon={<SuspendedIcon />}
          tone="warning"
          href="/academy/admin/users"
        />
        <StatCard
          value={data.adminCount + data.instructorCount + data.learnerCount}
          label="Directory"
          detail="Open the full user directory"
          icon={<UsersIcon />}
          tone="info"
          href="/academy/admin/users"
        />
      </StatGrid>
    </section>
  );
}
