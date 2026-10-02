import AcademyPage from "@/academy/page";
import AcademyOnboardingPage from "@/academy/onboarding/page";
import { AcademyAccessDenied } from "@/academy/components/AcademyAccessDenied";
import { AcademySurfacePending } from "@/academy/components/AcademySurfacePending";
import { ExplorePage } from "@/academy/explore/page";
import { ExploreProgramPage } from "@/academy/explore/programPage";
import { MyLearningPage } from "@/academy/learning/page";
import { CredentialsPage } from "@/academy/credentials/page";
import { CredentialDetailPage } from "@/academy/credentials/credentialDetailPage";
import { SubmitAppliedWorkPage } from "@/academy/credentials/submitPage";
import { SubmittedConfirmationPage } from "@/academy/credentials/submittedPage";
import { LessonPlayerPage } from "@/academy/lesson-player/page";
import { LessonUnavailable } from "@/academy/lesson-player/components/LessonUnavailable";
import { ResourcesPage } from "@/academy/resources/page";
import { InstructorComingSoon } from "@/academy/instructor/components/InstructorComingSoon";
import { InstructorDashboardPage } from "@/academy/instructor/page";
import { InstructorProgramsPage } from "@/academy/instructor/programs/page";
import { InstructorReviewsPage } from "@/academy/instructor/reviews/page";
import { InstructorReviewDetailPage } from "@/academy/instructor/reviews/reviewPage";
import { InstructorQuestionBankPage } from "@/academy/instructor/question-bank/page";
import { NewProgramPage } from "@/academy/instructor/programs/new/page";
import { InstructorGeneratingPage } from "@/academy/instructor/programs/generatingPage";
import { InstructorProgramEditorPage } from "@/academy/instructor/programs/programPage";
import { InstructorProgramPreviewPage } from "@/academy/instructor/programs/previewPage";
import { InstructorQuizEditorPage } from "@/academy/instructor/quiz-editor/page";
import { AdminDashboardPage } from "@/academy/admin/page";
import { AdminProgramsPage } from "@/academy/admin/programs/page";
import { CatalogProgramPage } from "@/academy/admin/catalog/page";
import { CatalogGeneratingPage } from "@/academy/admin/catalog/generatingPage";
import { AdminNewProgramPage } from "@/academy/admin/catalog/newPage";
import { CatalogWhitbyDraftPage } from "@/academy/admin/catalog/whitbyDraftPage";
import { toDbProgramType } from "@/academy/lib/courseMetadata";
import { AdminApprovalsPage } from "@/academy/admin/approvals/page";
import { AdminApprovalDetailPage } from "@/academy/admin/approvals/requestPage";
import {
  AdminApprovalPublishedPage,
  AdminApprovalReturnedPage,
} from "@/academy/admin/approvals/outcomePage";
import { AdminApprovalSectionPage } from "@/academy/admin/approvals/sectionReviewPage";
import { AdminInstructorsPage } from "@/academy/admin/instructors/page";
import { AdminInstructorDetailPage } from "@/academy/admin/instructors/instructorPage";
import { AcademyUsersPage } from "@/academy/admin/users/page";
import { AcademyAdminsPage } from "@/academy/admin/admins/page";
import { AcademyAdminDetailPage } from "@/academy/admin/admins/adminPage";
import { AcademyAuditLogsPage } from "@/academy/admin/audit/page";
import { AdminSettingsPage } from "@/academy/admin/settings/page";
import { AdminCredentialsPage } from "@/academy/admin/credentials/page";
import { AdminCredentialReviewPage } from "@/academy/admin/credentials/reviewPage";
import { AdminCredentialAwardedPage } from "@/academy/admin/credentials/awardedPage";
import { AdminRenewalsPage } from "@/academy/admin/credentials/renewalsPage";
import { AdminRenewalDetailPage } from "@/academy/admin/credentials/renewalDetailPage";
import { AdminQuestionBankPage } from "@/academy/admin/question-bank/page";
import { CheckoutPage, ProgramCheckoutPage } from "@/academy/enrollment/checkoutPage";
import { AdminEnrollmentsPage } from "@/academy/admin/enrollments/page";
import { AdminProgramEnrollmentsPage } from "@/academy/admin/enrollments/programPage";
import { VerifyCertificatePage } from "@/academy/credentials/verifyPage";
import { CredentialRenewPage } from "@/academy/credentials/renewPage";
import { redirect } from "next/navigation";
import { requireAcademyAccess } from "@/academy/lib/access";
import { COURSE_TAG_MIN } from "@/academy/lib/courseTags/constants";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  canAccessLearnerArea,
  isAcademySuperAdmin,
} from "@/academy/lib/authorization";

function isInstructorPath(path: string) {
  return path === "instructor" || path.startsWith("instructor/") || path === "lms" || path.startsWith("lms/");
}

/** Catalog / ops surfaces — Super Admin focuses on people management instead. */
function isSuperAdminCatalogOpsPath(rest: string) {
  return (
    rest === "programs" ||
    rest.startsWith("programs/") ||
    rest === "catalog" ||
    rest.startsWith("catalog/") ||
    rest === "question-bank" ||
    rest === "tags" ||
    rest === "approvals" ||
    rest.startsWith("approvals/") ||
    rest === "credentials" ||
    rest.startsWith("credentials/") ||
    rest === "settings"
  );
}

const PROGRAM_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whitby Type is Free/Paid; old URLs may still carry program-kind labels or legacy slugs. */
function generatingTypeLabel(raw: string) {
  const type = raw.trim();
  const key = type.toLowerCase();
  if (key === "free" || key === "paid") {
    return key === "paid" ? "Paid" : "Free";
  }
  const legacy = new Set([
    "paid_course",
    "free_course",
    "cpa",
    "professional_practice_accelerator",
    "specialty_endorsement",
    "intelligent_coordination",
  ]);
  if (!legacy.has(key)) return type;
  const db = toDbProgramType(type);
  if (db === "short_course") return "Short Course";
  if (db === "certification_program") return "Certification Program";
  if (db === "endorsement_program") return "Specialty Endorsement";
  return "Course";
}

function hasCourseGenOptions(length: string, difficulty: string, type: string) {
  return Boolean(length.trim() && difficulty.trim() && type.trim());
}

function parseCourseGenTagIds(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ].slice(0, 3);
}

function instructorRoot(path: string) {
  if (path === "lms" || path.startsWith("lms/")) return "lms";
  return "instructor";
}

function isAdminPath(path: string) {
  return path === "admin" || path.startsWith("admin/");
}

function isOnboardingPath(path: string) {
  return path === "onboarding" || path.startsWith("onboarding/");
}

function isVerifyPath(path: string) {
  return path === "verify" || path.startsWith("verify/");
}

async function denyIfNotLearner(status: "preview" | "denied" | "ok", user: { id: string } | null) {
  if (status === "denied") return <AcademyAccessDenied />;
  if (status === "ok" && user && !(await canAccessLearnerArea(user))) {
    const [admin, instructor] = await Promise.all([
      canAccessAdminArea(user),
      canAccessInstructorArea(user),
    ]);
    if (admin) redirect("/academy/admin");
    if (instructor) redirect("/academy/instructor");
    // Entitled but not yet a Learner (or mid-setup) — finish learner onboarding.
    redirect("/academy/onboarding/account");
  }
  return null;
}

export async function resolveAcademyRoute(
  path: string,
  segments: string[],
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  // Public certificate verification — no Academy login required.
  if (isVerifyPath(path)) {
    const code = segments[1] ?? "";
    return <VerifyCertificatePage code={code} />;
  }

  const access = await requireAcademyAccess();

  if (isOnboardingPath(path)) {
    if (access.status === "denied") return <AcademyAccessDenied />;
    return <AcademyOnboardingPage segments={segments} />;
  }

  if (isInstructorPath(path)) {
    if (access.status === "denied") return <AcademyAccessDenied />;
    // Non-instructors: go home instead of an access-required interstitial.
    if (access.status === "ok" && !(await canAccessInstructorArea(access.user))) {
      redirect("/academy");
    }

    const userId = access.user?.id ?? "";
    const root = instructorRoot(path);
    const rest = path === root ? "" : path.slice(root.length + 1);

    if (!rest) {
      return <InstructorDashboardPage userId={userId} />;
    }

    if (rest === "programs" || rest === "course-builder") {
      return <InstructorProgramsPage userId={userId} />;
    }

    if (rest === "reviews") {
      return <InstructorReviewsPage userId={userId} searchParams={searchParams} />;
    }

    if (rest === "question-bank") {
      return <InstructorQuestionBankPage userId={userId} searchParams={searchParams} />;
    }

    const reviewMatch = rest.match(/^reviews\/([^/]+)$/);
    const reviewId = reviewMatch?.[1] ?? "";
    if (reviewMatch && PROGRAM_ID.test(reviewId)) {
      return <InstructorReviewDetailPage submissionId={reviewId} />;
    }

    if (rest === "programs/new") {
      return <NewProgramPage />;
    }

    if (rest === "programs/generating") {
      const prompt = typeof searchParams.prompt === "string" ? searchParams.prompt.trim() : "";
      const length = typeof searchParams.length === "string" ? searchParams.length.trim() : "";
      const difficulty =
        typeof searchParams.difficulty === "string" ? searchParams.difficulty.trim() : "";
      const typeRaw = typeof searchParams.type === "string" ? searchParams.type.trim() : "";
      const tagIds = parseCourseGenTagIds(searchParams.tags);
      if (
        !prompt ||
        !hasCourseGenOptions(length, difficulty, typeRaw) ||
        tagIds.length < COURSE_TAG_MIN
      ) {
        redirect("/academy/instructor/programs");
      }
      return (
        <InstructorGeneratingPage
          prompt={prompt}
          length={length}
          difficulty={difficulty}
          type={generatingTypeLabel(typeRaw)}
          tagIds={tagIds}
        />
      );
    }

    if (rest === "quiz-editor") {
      return <InstructorComingSoon title="Quiz Editor" />;
    }

    const quizMatch = rest.match(/^programs\/([^/]+)\/quiz\/([^/]+)$/);
    const quizProgramId = quizMatch?.[1] ?? "";
    const quizLessonId = quizMatch?.[2] ?? "";
    if (quizMatch && PROGRAM_ID.test(quizProgramId) && PROGRAM_ID.test(quizLessonId)) {
      return <InstructorQuizEditorPage programId={quizProgramId} lessonId={quizLessonId} />;
    }

    const programMatch = rest.match(/^programs\/([^/]+)(?:\/(preview))?$/);
    const programId = programMatch?.[1] ?? "";
    if (programMatch && PROGRAM_ID.test(programId)) {
      if (programMatch[2] === "preview") {
        return <InstructorProgramPreviewPage userId={userId} programId={programId} />;
      }
      return <InstructorProgramEditorPage userId={userId} programId={programId} />;
    }

    return <InstructorComingSoon title="Not available" />;
  }

  if (isAdminPath(path)) {
    if (access.status === "denied") return <AcademyAccessDenied />;
    // Learners (and other non-admins) should never land on an "Admin access required"
    // interstitial — send them home. Admins keep every admin route as before.
    if (access.status === "ok" && !(await canAccessAdminArea(access.user))) {
      redirect("/academy");
    }

    const rest = path === "admin" ? "" : path.slice("admin/".length);

    if (
      rest &&
      isSuperAdminCatalogOpsPath(rest) &&
      access.status === "ok" &&
      access.user &&
      (await isAcademySuperAdmin(access.user))
    ) {
      redirect("/academy/admin");
    }

    if (!rest) {
      return <AdminDashboardPage />;
    }

    if (rest === "programs") {
      return <AdminProgramsPage />;
    }

    if (rest === "question-bank") {
      return <AdminQuestionBankPage searchParams={searchParams} />;
    }

    if (rest === "tags") {
      redirect("/academy/admin/question-bank?tab=tags");
    }

    if (rest === "programs/new") {
      return <AdminNewProgramPage />;
    }

    if (rest === "catalog/generating") {
      const prompt = typeof searchParams.prompt === "string" ? searchParams.prompt.trim() : "";
      const length = typeof searchParams.length === "string" ? searchParams.length.trim() : "";
      const difficulty =
        typeof searchParams.difficulty === "string" ? searchParams.difficulty.trim() : "";
      const typeRaw = typeof searchParams.type === "string" ? searchParams.type.trim() : "";
      const tagIds = parseCourseGenTagIds(searchParams.tags);
      if (
        !prompt ||
        !hasCourseGenOptions(length, difficulty, typeRaw) ||
        tagIds.length < COURSE_TAG_MIN
      ) {
        redirect("/academy/admin/programs");
      }
      return (
        <CatalogGeneratingPage
          prompt={prompt}
          length={length}
          difficulty={difficulty}
          type={generatingTypeLabel(typeRaw)}
          tagIds={tagIds}
        />
      );
    }

    if (rest === "catalog/new") {
      return <AdminNewProgramPage />;
    }

    if (rest === "catalog/whitby-draft") {
      const id = typeof searchParams.id === "string" ? searchParams.id : "";
      return <CatalogWhitbyDraftPage programId={id} />;
    }

    const catalogMatch = rest.match(/^catalog\/([^/]+)$/);
    const catalogProgramId = catalogMatch?.[1] ?? "";
    if (catalogMatch && PROGRAM_ID.test(catalogProgramId)) {
      const tabParam = typeof searchParams.tab === "string" ? searchParams.tab : "";
      const tab =
        tabParam === "preview" || tabParam === "settings" ? tabParam : "build";
      return <CatalogProgramPage programId={catalogProgramId} initialTab={tab} />;
    }

    if (rest === "approvals") {
      return <AdminApprovalsPage searchParams={searchParams} />;
    }

    const sectionMatch = rest.match(/^approvals\/([^/]+)\/sections\/([^/]+)$/);
    const sectionRequestId = sectionMatch?.[1] ?? "";
    const sectionLessonId = sectionMatch?.[2] ?? "";
    if (sectionMatch && PROGRAM_ID.test(sectionRequestId) && PROGRAM_ID.test(sectionLessonId)) {
      return (
        <AdminApprovalSectionPage requestId={sectionRequestId} lessonId={sectionLessonId} />
      );
    }

    const publishedMatch = rest.match(/^approvals\/([^/]+)\/published$/);
    const publishedRequestId = publishedMatch?.[1] ?? "";
    if (publishedMatch && PROGRAM_ID.test(publishedRequestId)) {
      return (
        <AdminApprovalPublishedPage requestId={publishedRequestId} searchParams={searchParams} />
      );
    }

    const returnedMatch = rest.match(/^approvals\/([^/]+)\/returned$/);
    const returnedRequestId = returnedMatch?.[1] ?? "";
    if (returnedMatch && PROGRAM_ID.test(returnedRequestId)) {
      return (
        <AdminApprovalReturnedPage requestId={returnedRequestId} searchParams={searchParams} />
      );
    }

    const requestMatch = rest.match(/^approvals\/([^/]+)$/);
    const requestId = requestMatch?.[1] ?? "";
    if (requestMatch && PROGRAM_ID.test(requestId)) {
      return <AdminApprovalDetailPage requestId={requestId} />;
    }

    if (rest === "enrollments") {
      return <AdminEnrollmentsPage />;
    }

    const programEnrollmentsMatch = rest.match(/^enrollments\/program\/([^/]+)$/);
    const programEnrollmentsId = programEnrollmentsMatch?.[1] ?? "";
    if (programEnrollmentsMatch && PROGRAM_ID.test(programEnrollmentsId)) {
      return <AdminProgramEnrollmentsPage programId={programEnrollmentsId} />;
    }

    const enrollmentMatch = rest.match(/^enrollments\/([^/]+)$/);
    const enrollmentId = enrollmentMatch?.[1] ?? "";
    if (enrollmentMatch && PROGRAM_ID.test(enrollmentId)) {
      // Per-enrollment admin detail removed — send bookmarks to the enrollments list.
      redirect("/academy/admin/enrollments");
    }

    if (rest === "admins") {
      return <AcademyAdminsPage />;
    }

    const adminDetailMatch = rest.match(/^admins\/([^/]+)$/);
    const adminUserId = adminDetailMatch?.[1] ?? "";
    if (adminDetailMatch && PROGRAM_ID.test(adminUserId)) {
      return <AcademyAdminDetailPage userId={adminUserId} />;
    }

    if (rest === "users") {
      return <AcademyUsersPage />;
    }

    if (rest === "audit") {
      return <AcademyAuditLogsPage />;
    }

    if (rest === "settings") {
      return <AdminSettingsPage />;
    }

    if (rest === "credentials") {
      return <AdminCredentialsPage searchParams={searchParams} />;
    }

    if (rest === "credentials/renewals") {
      return <AdminRenewalsPage />;
    }

    const renewalDetailMatch = rest.match(/^credentials\/renewals\/([^/]+)$/);
    const renewalRequestId = renewalDetailMatch?.[1] ?? "";
    if (renewalDetailMatch && PROGRAM_ID.test(renewalRequestId)) {
      return <AdminRenewalDetailPage renewalRequestId={renewalRequestId} />;
    }

    const awardedMatch = rest.match(/^credentials\/([^/]+)\/awarded$/);
    const awardedId = awardedMatch?.[1] ?? "";
    if (awardedMatch && PROGRAM_ID.test(awardedId)) {
      return <AdminCredentialAwardedPage credentialId={awardedId} />;
    }

    const credentialMatch = rest.match(/^credentials\/([^/]+)$/);
    const credentialId = credentialMatch?.[1] ?? "";
    if (credentialMatch && PROGRAM_ID.test(credentialId)) {
      return <AdminCredentialReviewPage credentialId={credentialId} />;
    }

    if (rest === "instructors") {
      return <AdminInstructorsPage />;
    }

    const instructorMatch = rest.match(/^instructors\/([^/]+)$/);
    const instructorUserId = instructorMatch?.[1] ?? "";
    if (instructorMatch && PROGRAM_ID.test(instructorUserId)) {
      return <AdminInstructorDetailPage userId={instructorUserId} />;
    }

    return <AcademySurfacePending surface="admin" />;
  }

  if (path === "learning") {
    const denied = await denyIfNotLearner(access.status, access.user);
    if (denied) return denied;
    return (
      <MyLearningPage
        userId={access.user?.id ?? ""}
        preview={access.status === "preview"}
      />
    );
  }

  if (path === "credentials") {
    const denied = await denyIfNotLearner(access.status, access.user);
    if (denied) return denied;
    return (
      <CredentialsPage
        userId={access.user?.id ?? ""}
        preview={access.status === "preview"}
      />
    );
  }

  if (path === "resources") {
    const denied = await denyIfNotLearner(access.status, access.user);
    if (denied) return denied;
    return (
      <ResourcesPage
        userId={access.user?.id ?? ""}
        preview={access.status === "preview"}
        searchParams={searchParams}
      />
    );
  }

  if (path.startsWith("resources/")) {
    const denied = await denyIfNotLearner(access.status, access.user);
    if (denied) return denied;
    return <LessonUnavailable reason="not_found" />;
  }

  if (path.startsWith("credentials/")) {
    const denied = await denyIfNotLearner(access.status, access.user);
    if (denied) return denied;
    const credentialId = segments[1] ?? "";
    const subPath = segments[2] ?? "";

    if (segments.length === 2 && credentialId) {
      return (
        <CredentialDetailPage
          userId={access.user?.id ?? ""}
          credentialId={credentialId}
          preview={access.status === "preview"}
        />
      );
    }

    if (segments.length === 3 && credentialId && subPath === "renew") {
      const paid = searchParams.paid === "1" || searchParams.paid === "true";
      const canceled = searchParams.canceled === "1" || searchParams.canceled === "true";
      return (
        <CredentialRenewPage
          credentialId={credentialId}
          flash={paid ? "paid" : canceled ? "canceled" : null}
        />
      );
    }

    if (segments.length === 3 && credentialId && subPath === "submit") {
      return (
        <SubmitAppliedWorkPage
          userId={access.user?.id ?? ""}
          credentialId={credentialId}
          preview={access.status === "preview"}
        />
      );
    }

    if (segments.length === 3 && credentialId && subPath === "submitted") {
      const submissionIndex = Number(searchParams.n ?? "1") || 1;
      const submissionTotal = Number(searchParams.total ?? "1") || 1;
      const programName =
        typeof searchParams.program === "string"
          ? decodeURIComponent(searchParams.program)
          : "credential";
      return (
        <SubmittedConfirmationPage
          userId={access.user?.id ?? ""}
          credentialId={credentialId}
          programName={programName}
          submissionIndex={submissionIndex}
          submissionTotal={submissionTotal}
          preview={access.status === "preview"}
        />
      );
    }

    return <LessonUnavailable reason="not_found" />;
  }

  if (path.startsWith("learning/")) {
    const denied = await denyIfNotLearner(access.status, access.user);
    if (denied) return denied;

    const programId = segments[1] ?? "";
    const lessonId = segments[2] ?? null;
    const preview = access.status === "preview";
    const userId = access.user?.id ?? "";

    if (segments.length === 2 || segments.length === 3) {
      return (
        <LessonPlayerPage
          userId={userId}
          preview={preview}
          programId={programId}
          lessonId={lessonId}
        />
      );
    }

    return <LessonUnavailable reason="not_found" />;
  }

  if (path.startsWith("checkout/")) {
    const denied = await denyIfNotLearner(access.status, access.user);
    if (denied) return denied;

    const checkoutId = segments[1] ?? "";
    if (segments.length === 2 && PROGRAM_ID.test(checkoutId)) {
      return (
        <CheckoutPage
          userId={access.user?.id ?? ""}
          preview={access.status === "preview"}
          checkoutId={checkoutId}
          searchParams={searchParams}
        />
      );
    }

    return <LessonUnavailable reason="not_found" />;
  }

  if (path === "explore" || path.startsWith("explore/")) {
    const denied = await denyIfNotLearner(access.status, access.user);
    if (denied) return denied;

    const preview = access.status === "preview";
    const userId = access.user?.id ?? "";
    const programId = path.startsWith("explore/") ? segments[1] : undefined;

    if (programId && segments.length === 3 && segments[2] === "checkout" && PROGRAM_ID.test(programId)) {
      return (
        <ProgramCheckoutPage
          userId={userId}
          preview={preview}
          programId={programId}
        />
      );
    }

    if (programId && segments.length === 2) {
      return <ExploreProgramPage userId={userId} preview={preview} programId={programId} />;
    }
    if (programId) {
      return <ExploreProgramPage userId={userId} preview={preview} programId="" />;
    }

    return (
      <ExplorePage userId={userId} preview={preview} searchParams={searchParams} />
    );
  }

  const denied = await denyIfNotLearner(access.status, access.user);
  if (denied) return denied;
  return <AcademyPage />;
}
