import { Suspense } from "react";
import { Callout } from "@/base/components/Callout";
import { CourseBuilder } from "./components/CourseBuilder";
import { loadCatalogProgram } from "./services/loadCatalogProgram";

async function ProgramBody({
  programId,
  initialTab,
}: {
  programId: string;
  initialTab?: "build" | "preview" | "settings";
}) {
  const result = await loadCatalogProgram(programId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Admin access required">
          This area is limited to Academy Admins.
        </Callout>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Program not found">
          This program could not be loaded.
        </Callout>
      </div>
    );
  }

  const { program } = result;

  return <CourseBuilder program={program} initialTab={initialTab} />;
}

function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="h-[48px] animate-pulse border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
      <div className="flex flex-1">
        <div className="w-[200px] animate-pulse border-r" style={{ borderColor: "var(--border)" }} />
        <div className="flex-1 p-8">
          <div className="h-6 w-48 animate-pulse rounded bg-border" />
          <div className="mt-4 h-[300px] animate-pulse rounded bg-border" />
        </div>
      </div>
    </div>
  );
}

export function CatalogProgramPage({
  programId,
  initialTab,
}: {
  programId: string;
  initialTab?: "build" | "preview" | "settings";
}) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ProgramBody programId={programId} initialTab={initialTab} />
    </Suspense>
  );
}
