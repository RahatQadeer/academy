import type {
  DocumentNeededAction,
  DocumentStatus,
  PartnerDocumentKind,
} from "@/partner-center/documents/types";
import {
  programLabelForDocument,
  programLabelFromMeta,
  type PartnerDocumentProgram,
} from "@/partner-center/documents/lib/meta";
import { formatShortDate } from "@/partner-center/referrals/lib/format";

type PillTone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const PROGRAM_FILTER_TO_LABEL: Record<string, string> = {
  academy: "Academy",
  platform: "Whitby",
  enterprise: "Enterprise",
};

export function documentStatusLabel(status: DocumentStatus): string {
  if (status === "action_needed") return "Action Needed";
  if (status === "current") return "Current";
  if (status === "completed") return "Completed";
  return "Archived";
}

export function documentStatusTone(status: DocumentStatus): PillTone {
  if (status === "current") return "success";
  if (status === "action_needed") return "warning";
  if (status === "completed") return "info";
  return "neutral";
}

export function formatDocumentDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatShortDate(iso) || "—";
}

export function programFilterLabel(filter: string): string {
  return PROGRAM_FILTER_TO_LABEL[filter] ?? filter;
}

/** Match Program filter against structured programLabel from meta (§14.4). */
export function matchesProgramFilter(
  programLabel: string,
  program: string,
): boolean {
  if (program === "all") return true;
  // Org-wide agreement applies to every program family.
  if (programLabel === "All") return true;
  const expected = PROGRAM_FILTER_TO_LABEL[program];
  if (!expected) return true;
  return programLabel === expected;
}

export function programDisplayLabel(
  program: PartnerDocumentProgram | null | undefined,
  documentKind?: PartnerDocumentKind | null,
): string {
  if (documentKind !== undefined) {
    return programLabelForDocument({ program, documentKind });
  }
  return programLabelFromMeta(program ?? null);
}

export function typeLabelFromDocumentKind(
  kind: PartnerDocumentKind,
  title?: string,
): string {
  if (kind === "agreement") return "Partner Agreement";
  if (kind === "program_terms") return "Program Terms";
  if (kind === "guideline") return "Guideline";
  if (kind === "marketing") return "Marketing";
  if (kind === "tax") return "Tax form";
  const trimmed = title?.trim();
  return trimmed || "Document";
}

/** Resolve Action Needed CTA from status + meta.needed_action (§14.6). */
export function resolveNeededAction(input: {
  status: DocumentStatus;
  neededAction: DocumentNeededAction;
  fileUrl: string | null;
}): DocumentNeededAction {
  if (input.status !== "action_needed") return null;
  if (!input.fileUrl?.trim()) return input.neededAction ?? "upload";
  return input.neededAction ?? "review";
}

export function actionLabelFor(
  action: DocumentNeededAction,
  status: DocumentStatus,
): string {
  if (action === "review") return "Review";
  if (action === "sign_externally") return "Sign";
  if (action === "upload") return "Upload";
  if (action === "update") return "Update";
  if (status === "archived") return "View";
  return "View";
}

export function actionHrefFor(
  documentId: string,
  action: DocumentNeededAction,
  documentKind: PartnerDocumentKind,
): string {
  if (action === "review" && documentKind === "tax") {
    return "/partner-center/tax";
  }
  // Always open the document first — sign / upload / update CTAs live on the
  // detail page so the partner can read or download before uploading.
  return `/partner-center/documents/${documentId}`;
}

export function previewKindFromUrl(
  fileUrl: string,
): "pdf" | "image" | "other" {
  if (fileUrl.startsWith("/")) return "other";
  const lower = fileUrl.toLowerCase();
  if (lower.endsWith(".pdf") || lower.includes(".pdf?")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(lower)) return "image";
  return "other";
}

export function isAppPathFileUrl(fileUrl: string): boolean {
  return fileUrl.startsWith("/");
}

export function jsonStringField(
  rules: unknown,
  key: string,
): string | null {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return null;
  const value = (rules as Record<string, unknown>)[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const parts = value
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item) => item.trim());
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return null;
}
