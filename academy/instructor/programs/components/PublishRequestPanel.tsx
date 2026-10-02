import { Button } from "@/base/components/Button";
import type { AcademyProgramStatus, AcademyPublishRequestStatus } from "@/academy/lib/domain";
import { InstructorStatus } from "@/academy/instructor/components/InstructorStatus";
import { EditorCard } from "./EditorCard";
import { PublishProgramButton } from "./PublishProgramButton";

export function PublishRequestPanel({
  programStatus,
  requestStatus,
  disabled,
  pending,
  publishing,
  onSubmit,
  onPublish,
}: {
  programStatus: AcademyProgramStatus;
  requestStatus: AcademyPublishRequestStatus | null;
  disabled?: boolean;
  pending?: boolean;
  publishing?: boolean;
  onSubmit: () => void;
  onPublish: () => void;
}) {
  const live = programStatus === "published";
  const waiting = requestStatus === "pending" || (programStatus === "pending_approval" && requestStatus !== "approved");
  const approved = requestStatus === "approved" && !live;
  const returned = requestStatus === "rejected";

  return (
    <EditorCard
      title="Catalog publishing"
      description="Instructors cannot publish until an Academy Admin approves the request."
    >
      <div className="space-y-4">
        <InstructorStatus programStatus={programStatus} publishRequestStatus={requestStatus} />

        {live ? (
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            This program is live in Explore. Published programs cannot be edited here.
          </p>
        ) : approved ? (
          <div>
            <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--success-fg)" }}>
              Approved. You can publish this program to the catalog.
            </p>
            <PublishProgramButton pending={publishing} disabled={disabled} onPublish={onPublish} />
          </div>
        ) : waiting ? (
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--warning-fg)" }}>
            Submitted. Waiting for Academy Admin review.
          </p>
        ) : (
          <div>
            {returned ? (
              <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--warning-fg)" }}>
                The last request was returned. You can edit and submit again.
              </p>
            ) : null}
            <Button variant="secondary" disabled={disabled || pending} onClick={onSubmit}>
              {pending ? "Submitting…" : "Submit for approval"}
            </Button>
          </div>
        )}
      </div>
    </EditorCard>
  );
}
