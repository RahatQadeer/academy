import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { QuestionBankResults } from "@/academy/components/questionBank/QuestionBankView";
import { QuestionBankSkeleton } from "@/academy/components/questionBank/QuestionBankSkeleton";
import {
  AddQuestionButton,
  AddQuestionComposer,
  QuestionBankNotice,
} from "@/academy/components/questionBank/AddQuestionComposer";
import { InstructorHeader } from "@/academy/instructor/components/InstructorHeader";
import { canAccessInstructorArea, isInstructor } from "@/academy/lib/authorization";
import { loadQuestionBank } from "@/academy/lib/questionBank/loadQuestionBank";
import { loadQuestionBankQuizTargets } from "@/academy/lib/questionBank/loadQuizTargets";
import {
  INSTRUCTOR_QUESTION_BANK_PATH,
  parseQuestionBankSearchParams,
} from "@/academy/lib/questionBank/href";
import { getSessionProfile } from "@/base/identity/session";

function Unavailable() {
  return (
    <PageShell>
      <InstructorHeader
        title="Question bank"
        description="Write once, reuse anywhere. Keep prompts ready for your quizzes and assignments."
      />
      <ErrorState title="Question bank unavailable" body="Questions could not be loaded. Try again." />
    </PageShell>
  );
}

async function QuestionBankBody({
  userId,
  searchParams,
}: {
  userId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  try {
    const profile = await getSessionProfile();
    if (!profile || profile.user.id !== userId) {
      return (
        <PageShell>
          <ErrorState title="Sign in required" body="Sign in as an instructor to browse the question bank." />
        </PageShell>
      );
    }

    const actor = { id: profile.user.id };
    const parsedFilters = parseQuestionBankSearchParams(searchParams);

    const [area, instructor, result, targets] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
      loadQuestionBank({
        userId,
        scope: "instructor",
        filters: parsedFilters,
      }),
      loadQuestionBankQuizTargets({
        userId,
        scope: "instructor",
        lite: true,
      }),
    ]);

    if (!area || !instructor) {
      return (
        <PageShell>
          <ErrorState title="Instructor access required" body="You need instructor access to browse the question bank." />
        </PageShell>
      );
    }

    if (!result.ok) return <Unavailable />;

    const programs = targets.ok ? targets.programs : [];

    return (
      <AddQuestionComposer
        programs={programs}
        defaultProgramId={result.data.activeFilters.programId}
        defaultModuleId={result.data.activeFilters.moduleId}
        scope="instructor"
      >
        <PageShell>
          <InstructorHeader
            eyebrow="Library"
            title="Question bank"
            description="Write once, reuse anywhere. Keep prompts ready for your quizzes and assignments."
            actions={<AddQuestionButton />}
          />
          <QuestionBankNotice />

          <QuestionBankResults
            basePath={INSTRUCTOR_QUESTION_BANK_PATH}
            scope="instructor"
            data={result.data}
            emptyMessage="No questions match this view. Add a custom multiple-choice, true/false, or assignment prompt, then reuse it in a quiz or assignment."
            actionLabel="Open quiz"
            actionMode="instructor-quiz"
          />
        </PageShell>
      </AddQuestionComposer>
    );
  } catch {
    return <Unavailable />;
  }
}

export function InstructorQuestionBankPage({
  userId,
  searchParams,
}: {
  userId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<QuestionBankSkeleton />}>
      <QuestionBankBody userId={userId} searchParams={searchParams} />
    </Suspense>
  );
}
