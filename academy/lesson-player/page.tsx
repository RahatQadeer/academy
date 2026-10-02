import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { LessonPlayer } from "./components/LessonPlayer";
import { LessonPlayerSkeleton } from "./components/LessonPlayerSkeleton";
import { LessonUnavailable } from "./components/LessonUnavailable";
import { loadLessonPlayer } from "./services/loadLessonPlayer";
import { lessonPlayerHref } from "./utils/curriculum";

async function LessonPlayerBody({
  userId,
  programId,
  lessonId,
}: {
  userId: string;
  programId: string;
  lessonId: string | null;
}) {
  const result = await loadLessonPlayer(userId, programId, lessonId);

  if (!result.ok) {
    return <LessonUnavailable reason={result.reason} programId={programId} />;
  }

  if ("redirectToLessonId" in result) {
    redirect(lessonPlayerHref(result.programId, result.redirectToLessonId));
  }

  return <LessonPlayer data={result.data} />;
}

export function LessonPlayerPage({
  userId,
  preview,
  programId,
  lessonId,
}: {
  userId: string;
  preview: boolean;
  programId: string;
  lessonId: string | null;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<LessonPlayerSkeleton />}>
        <LessonPlayerBody userId={userId} programId={programId} lessonId={lessonId} />
      </Suspense>
    </AcademyEntry>
  );
}
