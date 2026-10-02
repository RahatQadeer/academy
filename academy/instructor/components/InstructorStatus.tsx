import { Pill } from "@/base/components/Pill";
import type { AcademyProgramStatus, AcademyPublishRequestStatus } from "@/academy/lib/domain";
import { programStatusLabel, publishRequestLabel } from "../utils/labels";

function programTone(status: AcademyProgramStatus) {
  if (status === "published") return "success" as const;
  if (status === "pending_approval") return "warning" as const;
  return "neutral" as const;
}

function requestTone(status: AcademyPublishRequestStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  return "danger" as const;
}

export function InstructorStatus({
  programStatus,
  publishRequestStatus,
}: {
  programStatus: AcademyProgramStatus;
  publishRequestStatus: AcademyPublishRequestStatus | null;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Pill tone={programTone(programStatus)}>{programStatusLabel(programStatus)}</Pill>
      {publishRequestStatus && programStatus !== "published" ? (
        <Pill tone={requestTone(publishRequestStatus)}>
          {publishRequestLabel(publishRequestStatus)}
        </Pill>
      ) : null}
    </div>
  );
}
