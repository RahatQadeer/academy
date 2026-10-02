import type { AcademyProgramStatus } from "@/academy/lib/domain";

export type CatalogProgramDeletionBlock =
  | "published"
  | "active_enrollments"
  | "learner_records";

export type CatalogProgramDeletionInput = {
  status: AcademyProgramStatus;
  enrollmentCount: number;
  activeEnrollmentCount?: number;
};

export type DeleteAdminCatalogProgramResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthorized" | CatalogProgramDeletionBlock | "failed";
      message?: string;
      activeEnrollmentCount?: number;
    };

export function getCatalogProgramDeletionBlock(
  input: CatalogProgramDeletionInput,
): CatalogProgramDeletionBlock | null {
  if (input.status === "published") return "published";

  const active = input.activeEnrollmentCount ?? input.enrollmentCount;
  if (active > 0) return "active_enrollments";
  if (input.enrollmentCount > 0) return "learner_records";

  return null;
}

export function catalogProgramCanBeDeleted(input: CatalogProgramDeletionInput): boolean {
  return getCatalogProgramDeletionBlock(input) === null;
}

export function catalogProgramDeletionMessage(
  block: CatalogProgramDeletionBlock,
  activeEnrollmentCount = 0,
): string {
  switch (block) {
    case "published":
      return "Published programs can't be deleted. Hide them from the catalog instead — enrolled learners can finish, and certificates stay issued.";
    case "active_enrollments":
      return activeEnrollmentCount === 1
        ? "This program has 1 learner enrolled, so it can't be deleted."
        : `This program has ${activeEnrollmentCount.toLocaleString()} learners enrolled, so it can't be deleted.`;
    case "learner_records":
      return "This program has learner records, so it can't be deleted.";
  }
}

export function catalogProgramDeletionMenuHint(
  block: CatalogProgramDeletionBlock,
): string {
  switch (block) {
    case "published":
      return "Hide from catalog instead. Enrolled learners keep access; certificates stay.";
    case "active_enrollments":
      return "Can't delete while learners are enrolled";
    case "learner_records":
      return "Can't delete — learner records exist";
  }
}

export function catalogAdminStatusLabel(
  status: AcademyProgramStatus,
  enrollmentCount = 0,
): string {
  if (status === "published") return "Published";
  if (status === "pending_approval") return "Pending approval";
  if (enrollmentCount > 0) return "Hidden";
  return "Draft";
}
