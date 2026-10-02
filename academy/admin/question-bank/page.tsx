import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { QuestionBankResults } from "@/academy/components/questionBank/QuestionBankView";
import { QuestionBankSkeleton } from "@/academy/components/questionBank/QuestionBankSkeleton";
import {
  AddQuestionComposer,
  QuestionBankNotice,
} from "@/academy/components/questionBank/AddQuestionComposer";
import { loadCourseTags } from "@/academy/lib/courseTags/services";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { AdminHeader } from "../components/AdminHeader";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { loadQuestionBank } from "@/academy/lib/questionBank/loadQuestionBank";
import { loadQuestionBankQuizTargets } from "@/academy/lib/questionBank/loadQuizTargets";
import {
  ADMIN_QUESTION_BANK_PATH,
  parseQuestionBankSearchParams,
} from "@/academy/lib/questionBank/href";
import { getSessionProfile } from "@/base/identity/session";
import { AdminBankLibraryShell } from "./components/AdminBankLibraryShell";

function Unavailable() {
  return (
    <PageShell>
      <AdminHeader
        title="Question bank"
        description="Write once, reuse anywhere. Keep prompts ready for quizzes and assignments."
      />
      <ErrorState title="Question bank unavailable" body="Questions could not be loaded. Try again." />
    </PageShell>
  );
}

async function AdminQuestionBankBody({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return (
        <PageShell>
          <AdminAccessRequired />
        </PageShell>
      );
    }

    const actor = { id: profile.user.id };
    const parsedFilters = parseQuestionBankSearchParams(searchParams);

    const [area, admin, result, targets, tagsResult] = await Promise.all([
      canAccessAdminArea(actor),
      isAcademyAdmin(actor),
      loadQuestionBank({
        userId: profile.user.id,
        scope: "admin",
        filters: parsedFilters,
      }),
      loadQuestionBankQuizTargets({
        userId: profile.user.id,
        scope: "admin",
        lite: true,
      }),
      loadCourseTags({ includeArchived: true, withCounts: true }),
    ]);

    if (!area || !admin) {
      return (
        <PageShell>
          <AdminAccessRequired />
        </PageShell>
      );
    }

    if (!result.ok) return <Unavailable />;

    const programs = targets.ok ? targets.programs : [];
    const tags = tagsResult.ok ? tagsResult.tags : [];

    return (
      <AddQuestionComposer
        programs={programs}
        defaultProgramId={result.data.activeFilters.programId}
        defaultModuleId={result.data.activeFilters.moduleId}
        scope="admin"
      >
        <PageShell>
          <AdminHeader
            eyebrow="Library"
            title="Question bank"
            description="Reuse prompts in quizzes, and manage course tags authors pick when creating a program."
          />
          <QuestionBankNotice />

          <AdminBankLibraryShell
            tags={tags}
            questions={
              <QuestionBankResults
                basePath={ADMIN_QUESTION_BANK_PATH}
                scope="admin"
                data={result.data}
                emptyMessage="No questions match this view. Add a custom multiple-choice, true/false, or assignment prompt, then reuse it when you build a quiz or assignment."
                actionLabel="Open catalog"
                actionMode="admin-catalog"
                canManageCustom
              />
            }
          />
        </PageShell>
      </AddQuestionComposer>
    );
  } catch {
    return <Unavailable />;
  }
}

export function AdminQuestionBankPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<QuestionBankSkeleton />}>
      <AdminQuestionBankBody searchParams={searchParams} />
    </Suspense>
  );
}
