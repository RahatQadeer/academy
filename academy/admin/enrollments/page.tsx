import { ErrorState, PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { AdminHeader } from "../components/AdminHeader";
import { EnrollmentSkeleton } from "./components/EnrollmentSkeleton";
import { ProgramEnrollmentTable } from "./components/ProgramEnrollmentTable";
import { loadAdminEnrollments } from "./services/loadAdminEnrollments";
import { Suspense } from "react";

async function EnrollmentsBody() {
  const result = await loadAdminEnrollments();

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <PageShell>
        <AdminAccessRequired />
      </PageShell>
    );
  }

  if (!result.ok) {
    return (
      <PageShell>
        <AdminHeader
          title="Learners"
          description="Enrollment totals by status and program."
        />
        <ErrorState
          title="Learners unavailable"
          body="Learner records could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
        <AdminHeader
          title="Learners"
          description="See who is enrolled, who is in progress, and who has finished — then open a program to inspect individual records."
        />
      <ProgramEnrollmentTable data={result.data} />
    </PageShell>
  );
}

export function AdminEnrollmentsPage() {
  return (
    <Suspense fallback={<EnrollmentSkeleton />}>
      <EnrollmentsBody />
    </Suspense>
  );
}
