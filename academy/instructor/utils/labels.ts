import type {
  AcademyAssignmentPermission,
  AcademyProgramStatus,
  AcademyProgramType,
  AcademyPublishRequestStatus,
} from "@/academy/lib/domain";

export function permissionLabel(level: AcademyAssignmentPermission) {
  if (level === "create") return "Create & Edit";
  return "Edit";
}

export function permissionHint(level: AcademyAssignmentPermission) {
  if (level === "create") {
    return "Create new content and change existing content on the assigned coverage. Cannot approve or publish.";
  }
  return "Change existing content on the assigned coverage. Cannot approve or publish.";
}

export function programStatusLabel(status: AcademyProgramStatus) {
  if (status === "pending_approval") return "Pending approval";
  if (status === "published") return "Published";
  return "Draft";
}

export function publishRequestLabel(status: AcademyPublishRequestStatus) {
  if (status === "pending") return "Review requested";
  if (status === "approved") return "Approved to publish";
  return "Returned";
}

export function programTypeMark(type: AcademyProgramType) {
  if (type === "certification_program") return "CERT";
  if (type === "endorsement_program") return "SE";
  if (type === "short_course") return "SC";
  return "CR";
}

export function formatInstructorDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function structureLabel(moduleCount: number, lessonCount: number) {
  const modules = moduleCount === 1 ? "1 module" : `${moduleCount} modules`;
  const lessons = lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`;
  return `${modules} · ${lessons}`;
}

export function needsAttention(item: {
  programStatus: AcademyProgramStatus;
  publishRequestStatus: AcademyPublishRequestStatus | null;
}) {
  return (
    item.programStatus === "pending_approval" ||
    item.publishRequestStatus === "pending" ||
    item.publishRequestStatus === "rejected"
  );
}
