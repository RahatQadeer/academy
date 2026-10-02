import type { AcademyCredentialStatus, AcademyCredentialType } from "@/academy/lib/domain";

const TYPE_LABELS: Record<AcademyCredentialType, string> = {
  cpa_credential: "Certified Private Attaché",
  specialty_endorsement: "Specialty Endorsement",
  certificate_of_completion: "Certificate of Completion",
};

const STATUS_LABELS: Record<AcademyCredentialStatus, string> = {
  required_learning: "Required Learning",
  applied_work: "Applied Work & Submissions",
  final_assessment: "Final Assessment",
  credential_review: "Credential Review",
  awarded: "Awarded",
};

export function credentialTypeLabel(type: AcademyCredentialType) {
  return TYPE_LABELS[type];
}

export function credentialStatusLabel(status: AcademyCredentialStatus) {
  return STATUS_LABELS[status];
}

export function credentialStatusTone(
  status: AcademyCredentialStatus,
): "success" | "warning" | "info" {
  if (status === "awarded") return "success";
  if (status === "credential_review" || status === "final_assessment") return "warning";
  return "info";
}

export function isAcademyCredentialType(value: string): value is AcademyCredentialType {
  return value in TYPE_LABELS;
}

export function isAcademyCredentialStatus(value: string): value is AcademyCredentialStatus {
  return value in STATUS_LABELS;
}

export function formatCredentialDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
