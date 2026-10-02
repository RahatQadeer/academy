import type { AcademyCredentialStatus } from "@/academy/lib/domain";
import type { CredentialItem } from "../types";
import { credentialStatusLabel, formatCredentialDate } from "./labels";

/** Title-case a learner name for certificate display (e.g. "zara akhtar" → "Zara Akhtar"). */
export function formatCertificateName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return name;

  function capitalizeToken(token: string): string {
    if (!token) return token;
    return token
      .split("-")
      .map((segment) => {
        if (!segment) return segment;
        const lower = segment.toLocaleLowerCase("en-US");
        return lower.charAt(0).toLocaleUpperCase("en-US") + lower.slice(1);
      })
      .join("-");
  }

  return trimmed.split(" ").map(capitalizeToken).join(" ");
}

export function credentialSubtitle(item: CredentialItem): string {
  if (item.status === "awarded" && item.awardedAt) {
    return `Completed ${formatCredentialDate(item.awardedAt)}`;
  }
  if (item.status === "awarded") return "Awarded";
  if (item.certificateLocked && item.assignmentTotal > 0) {
    return `${item.assignmentReviewed}/${item.assignmentTotal} assignments reviewed — certificate locked`;
  }
  return `In progress — ${credentialStatusLabel(item.status)}`;
}

export function credentialStatusChip(
  status: AcademyCredentialStatus,
  locked?: boolean,
): string {
  if (status === "awarded") return "Awarded";
  if (locked) return "Locked";
  if (status === "credential_review") return "Eligible";
  return "In progress";
}

export function groupCredentials(items: CredentialItem[]) {
  return {
    credentials: items.filter((item) => item.type === "cpa_credential"),
    endorsements: items.filter((item) => item.type === "specialty_endorsement"),
    certificates: items.filter((item) => item.type === "certificate_of_completion"),
  };
}
