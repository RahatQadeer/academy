import { Suspense } from "react";
import Link from "next/link";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { InstructorManageView } from "./components/InstructorManageView";
import { AssignmentSkeleton } from "./components/AssignmentSkeleton";
import { InstructorRoleButton } from "./components/InstructorRoleButton";
import { loadInstructorAssignments } from "./services/loadInstructorAssignments";

async function InstructorBody({ userId }: { userId: string }) {
  const result = await loadInstructorAssignments(userId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <PageShell>
        <AdminAccessRequired />
      </PageShell>
    );
  }

  if (!result.ok && result.reason === "not_instructor") {
    return (
      <PageShell>
        <Link
          href="/academy/admin/instructors"
          className="mb-6 inline-block text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
        >
          ← Instructors
        </Link>
        <ErrorState
          title="This user is not an Academy Instructor"
          body="Grant the Instructor role first. Role provisioning is separate from program assignment."
        />
      </PageShell>
    );
  }

  if (!result.ok && result.reason === "not_found") {
    return (
      <PageShell>
        <Link
          href="/academy/admin/instructors"
          className="mb-6 inline-block text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
        >
          ← Instructors
        </Link>
        <ErrorState title="Instructor not found" body="This Instructor could not be opened." />
      </PageShell>
    );
  }

  if (!result.ok) {
    return (
      <PageShell>
        <Link
          href="/academy/admin/instructors"
          className="mb-6 inline-block text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
        >
          ← Instructors
        </Link>
        <ErrorState
          title="Assignments unavailable"
          body="Program assignments could not be loaded. Try again in a moment."
        />
      </PageShell>
    );
  }

  const detail = result.data;

  if (detail.membershipStatus === "suspended") {
    return (
      <PageShell>
        <CalloutSuspended userId={detail.userId} />
        <InstructorManageView detail={detail} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <InstructorManageView detail={detail} />
    </PageShell>
  );
}

function CalloutSuspended({ userId }: { userId: string }) {
  return (
    <div className="mb-6 space-y-3">
      <div
        className="rounded-[12px] px-5 py-4"
        style={{
          background: "var(--warning-bg)",
          boxShadow: "inset 0 0 0 1px var(--warning-border)",
          color: "var(--warning-fg)",
        }}
      >
        <p className="text-[14px] font-semibold">Instructor suspended</p>
        <p className="mt-1 text-[13px] leading-relaxed">
          Reactivate this instructor before assigning programs or reviewing activity.
        </p>
        <div className="mt-3">
          <InstructorRoleButton userId={userId} action="reactivate" />
        </div>
      </div>
    </div>
  );
}

export function AdminInstructorDetailPage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<AssignmentSkeleton />}>
      <InstructorBody userId={userId} />
    </Suspense>
  );
}
