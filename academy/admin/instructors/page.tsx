import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { InstructorsShell } from "./components/InstructorsShell";
import { AssignmentSkeleton } from "./components/AssignmentSkeleton";
import { loadInstructorProgramOptions } from "./services/loadInstructorProgramOptions";
import { loadInstructors } from "./services/loadInstructors";

async function InstructorsBody() {
  const [result, programsResult] = await Promise.all([
    loadInstructors(),
    loadInstructorProgramOptions(),
  ]);

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
        <ErrorState title="Instructors unavailable" body="Academy Instructors could not be loaded. Nothing has changed — try again." />
      </PageShell>
    );
  }

  const programs = programsResult.ok ? programsResult.programs : [];

  return (
    <PageShell>
      <InstructorsShell data={result.data} programs={programs} />
    </PageShell>
  );
}

export function AdminInstructorsPage() {
  return (
    <Suspense fallback={<AssignmentSkeleton />}>
      <InstructorsBody />
    </Suspense>
  );
}
