import { Suspense } from "react";
import { Callout } from "@/base/components/Callout";
import { PageShell } from "@/academy/components/ui";
import { InstructorComingSoon } from "@/academy/instructor/components/InstructorComingSoon";
import { ProgramEditor } from "./components/ProgramEditor";
import { ProgramEditorSkeleton } from "./components/ProgramEditorSkeleton";
import { loadProgramEditor } from "./services/loadProgramEditor";

async function EditorBody({ userId, programId }: { userId: string; programId: string }) {
  const result = await loadProgramEditor(userId, programId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <PageShell>
        <Callout tone="warning" title="Program not available">
          You can only edit programs you created or were assigned.
        </Callout>
      </PageShell>
    );
  }

  if (!result.ok && result.reason === "not_found") {
    return <InstructorComingSoon title="Program not found" />;
  }

  if (!result.ok) {
    return (
      <PageShell>
        <Callout tone="warning" title="Program unavailable">
          This program could not be loaded. Try again in a moment.
        </Callout>
      </PageShell>
    );
  }

  return <ProgramEditor initial={result.data} />;
}

export function InstructorProgramEditorPage({
  userId,
  programId,
}: {
  userId: string;
  programId: string;
}) {
  return (
    <Suspense fallback={<ProgramEditorSkeleton />}>
      <EditorBody userId={userId} programId={programId} />
    </Suspense>
  );
}
