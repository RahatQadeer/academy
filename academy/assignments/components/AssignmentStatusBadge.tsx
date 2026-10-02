import { Pill } from "@/base/components/Pill";
import type { AcademyAssignmentSubmissionStatus } from "@/academy/lib/domain";
import type { LearnerAssignmentState } from "../types";
import {
  assignmentQueueStatusLabel,
  assignmentQueueTone,
  assignmentStateLabel,
  assignmentStateTone,
} from "../utils/labels";

export function LearnerAssignmentBadge({ state }: { state: LearnerAssignmentState }) {
  return <Pill tone={assignmentStateTone(state)}>{assignmentStateLabel(state)}</Pill>;
}

export function InstructorSubmissionBadge({
  status,
}: {
  status: AcademyAssignmentSubmissionStatus;
}) {
  return <Pill tone={assignmentQueueTone(status)}>{assignmentQueueStatusLabel(status)}</Pill>;
}
