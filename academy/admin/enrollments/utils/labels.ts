import type { AcademyEnrollmentStatus, AcademyEntitlementSource } from "@/academy/lib/domain";

export function enrollmentStatusLabel(status: AcademyEnrollmentStatus) {
  if (status === "in_progress") return "In progress";
  if (status === "completed") return "Completed";
  return "Not started";
}

export function entitlementSourceLabel(source: AcademyEntitlementSource) {
  if (source === "purchase") return "Purchase";
  if (source === "admin_assigned") return "Organization assigned";
  if (source === "prerequisite_met") return "Prerequisite met";
  return "Free";
}
