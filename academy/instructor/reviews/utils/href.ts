import type { InstructorReviewStatusFilter } from "../types";

export function parseReviewStatus(value: string | undefined): InstructorReviewStatusFilter {
  if (
    value === "all" ||
    value === "graded" ||
    value === "resubmission_required" ||
    value === "submitted"
  ) {
    return value;
  }
  return "submitted";
}

export function reviewsQueueHref(params: {
  status?: string;
  programId?: string;
  assignmentId?: string;
  learner?: string;
}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== "submitted") query.set("status", params.status);
  if (params.programId) query.set("programId", params.programId);
  if (params.assignmentId) query.set("assignmentId", params.assignmentId);
  if (params.learner?.trim()) query.set("learner", params.learner.trim());
  const encoded = query.toString();
  return encoded ? `/academy/instructor/reviews?${encoded}` : "/academy/instructor/reviews";
}

export function queueCopy(status: InstructorReviewStatusFilter) {
  if (status === "graded") return "Scored work. Open a row to update marks or request a revision.";
  if (status === "resubmission_required") {
    return "Waiting on the learner. Certificates stay locked until you grade the next submission.";
  }
  if (status === "all") return "Every submitted assignment across your courses.";
  return "Learners waiting on marks. Grade these before certificates can be issued.";
}
