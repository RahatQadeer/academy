import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { InstructorHeader } from "@/academy/instructor/components/InstructorHeader";
import { InstructorSkeleton } from "@/academy/instructor/components/InstructorSkeleton";
import { InstructorProgramsBoard } from "@/academy/instructor/programs/components/InstructorProgramsBoard";
import { loadInstructorDashboard } from "@/academy/instructor/services/loadInstructorDashboard";
import { Button } from "@/base/components/Button";

async function ProgramsBody({ userId }: { userId: string }) {
  const result = await loadInstructorDashboard(userId);

  if (!result.ok) {
    return (
      <PageShell>
        <InstructorHeader
          title="My Programs"
          description="Generate a course with Whitby, or start from a blank outline. Publish when ready — Admin approval may still be required depending on your permissions."
          actions={
            <Button href="/academy/instructor/programs/new" variant="primary">
              New program
            </Button>
          }
        />
        <ErrorState
          title="Programs unavailable"
          body="Your assigned programs could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <InstructorProgramsBoard programs={result.data.programs} />
    </PageShell>
  );
}

export function InstructorProgramsPage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<InstructorSkeleton showStats={false} />}>
      <ProgramsBody userId={userId} />
    </Suspense>
  );
}
