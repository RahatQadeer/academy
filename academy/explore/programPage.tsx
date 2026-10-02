import { Suspense } from "react";
import { Callout } from "@/base/components/Callout";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { ExploreSkeleton } from "./components/ExploreSkeleton";
import { ProgramDetail, ProgramDetailUnavailable } from "./components/ProgramDetail";
import { loadProgramDetail } from "./services/loadProgramDetail";

async function ProgramDetailBody({
  userId,
  programId,
}: {
  userId: string;
  programId: string;
}) {
  const result = await loadProgramDetail(userId, programId);

  if (!result.ok) {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Program unavailable">
          This program could not be loaded. Try again in a moment.
        </Callout>
      </div>
    );
  }

  if (!result.data) {
    return <ProgramDetailUnavailable />;
  }

  return <ProgramDetail detail={result.data} />;
}

export function ExploreProgramPage({
  userId,
  preview,
  programId,
}: {
  userId: string;
  preview: boolean;
  programId: string;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<ExploreSkeleton />}>
        <ProgramDetailBody userId={userId} programId={programId} />
      </Suspense>
    </AcademyEntry>
  );
}
