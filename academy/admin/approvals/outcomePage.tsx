import { Suspense } from "react";
import { Callout } from "@/base/components/Callout";
import { programTypeLabel } from "@/academy/lib/domain";
import { ApprovalOutcome, type ApprovalOutcomeModel } from "./components/ApprovalOutcome";
import { ApprovalSkeleton } from "./components/ApprovalSkeleton";
import { loadPublishRequest } from "./services/loadPublishRequest";
import { formatApprovalReviewSubmittedAt } from "./utils/labels";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function cleanLabel(value: string | undefined) {
  const text = (value ?? "").trim();
  if (!text || /^undefined$/i.test(text) || /^null$/i.test(text)) return "";
  return text;
}

function specialtyLabel(category: string, type: string, fromQuery: string) {
  const query = cleanLabel(fromQuery).replace(/^specialty:\s*/i, "");
  const value = cleanLabel(category) || query || programTypeLabel(type);
  return value;
}

async function OutcomeBody({
  kind,
  requestId,
  searchParams,
}: {
  kind: "published" | "returned";
  requestId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const result = await loadPublishRequest(requestId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <div className="mx-auto max-w-[1080px] px-6 py-10 lg:px-10">
        <Callout tone="warning" title="Admin access required">
          This area is limited to Academy Admins.
        </Callout>
      </div>
    );
  }

  const detail = result.ok ? result.data : null;
  const sectionLabel = cleanLabel(firstParam(searchParams.lesson));
  const instructor =
    cleanLabel(detail?.submittedByName) || cleanLabel(firstParam(searchParams.instructor)) || "The instructor";
  const programName =
    cleanLabel(detail?.program.name) || cleanLabel(firstParam(searchParams.program)) || "This program";
  const specialty = specialtyLabel(
    detail?.program.category ?? "",
    detail?.program.type ?? "",
    firstParam(searchParams.specialty),
  );
  const whenValue = kind === "published" ? detail?.publishedAt || detail?.reviewedAt : detail?.reviewedAt;
  const whenLabel = whenValue ? formatApprovalReviewSubmittedAt(whenValue) : "Just now";

  const model: ApprovalOutcomeModel = {
    kind,
    requestId,
    programId: detail?.program.id ?? "",
    programName,
    sectionLabel,
    specialty,
    instructor,
    whenLabel,
    notes: kind === "returned" ? cleanLabel(detail?.notes ?? "") : "",
  };

  return <ApprovalOutcome model={model} />;
}

export function AdminApprovalPublishedPage({
  requestId,
  searchParams,
}: {
  requestId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<ApprovalSkeleton />}>
      <OutcomeBody kind="published" requestId={requestId} searchParams={searchParams} />
    </Suspense>
  );
}

export function AdminApprovalReturnedPage({
  requestId,
  searchParams,
}: {
  requestId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <Suspense fallback={<ApprovalSkeleton />}>
      <OutcomeBody kind="returned" requestId={requestId} searchParams={searchParams} />
    </Suspense>
  );
}
