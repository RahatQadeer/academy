import { Suspense } from "react";
import Link from "next/link";
import { ErrorState, PageHeader, PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { EnrollmentEmptyState } from "./components/EnrollmentEmptyState";
import { ProgramEnrollmentSkeleton } from "./components/EnrollmentSkeleton";
import { ProgramEnrollmentList } from "./components/ProgramEnrollmentList";
import { ProgramEnrollmentSummary } from "./components/ProgramEnrollmentSummary";
import { loadProgramEnrollments } from "./services/loadProgramEnrollments";

function BackLink() {
  return (
    <Link
      href="/academy/admin/enrollments"
      className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M8.5 3.5L5 7l3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      All enrollments
    </Link>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center rounded-[6px] px-2.5 py-1 text-[12px] font-semibold tabular-nums"
      style={{
        background: "var(--surface-soft)",
        color: "var(--text-secondary)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      {count.toLocaleString()} enrolled
    </span>
  );
}

async function ProgramEnrollmentsBody({ programId }: { programId: string }) {
  const result = await loadProgramEnrollments(programId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <PageShell>
        <AdminAccessRequired />
      </PageShell>
    );
  }

  if (!result.ok && result.reason === "not_found") {
    return (
      <PageShell>
        <BackLink />
        <ErrorState title="Program not found" body="This program could not be opened." />
      </PageShell>
    );
  }

  if (!result.ok) {
    return (
      <PageShell>
        <BackLink />
        <ErrorState
          title="Enrollments unavailable"
          body="Enrollments for this program could not be loaded. Try again in a moment."
        />
      </PageShell>
    );
  }

  const { programName, items, truncated } = result.data;

  return (
    <PageShell>
      <BackLink />
      <PageHeader
        eyebrow="Program enrollments"
        title={programName}
        description="Review who is enrolled in this program, how far they have progressed, and when they joined."
        actions={<CountBadge count={items.length} />}
        className="mb-6"
      />
      {items.length === 0 ? (
        <EnrollmentEmptyState kind="program" />
      ) : (
        <>
          <ProgramEnrollmentSummary items={items} />
          <ProgramEnrollmentList items={items} truncated={truncated} />
        </>
      )}
    </PageShell>
  );
}

export function AdminProgramEnrollmentsPage({ programId }: { programId: string }) {
  return (
    <Suspense fallback={<ProgramEnrollmentSkeleton />}>
      <ProgramEnrollmentsBody programId={programId} />
    </Suspense>
  );
}
