import type { PartnerProfileStatus } from "@/partner-center/types/partner";

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const stamp = Date.parse(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(stamp)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(stamp));
}

export function profileStatusLabel(status: string): string {
  const key = status.toLowerCase();
  if (key === "applied") return "Submitted";
  if (key === "under_review") return "Under review";
  if (key === "approved") return "Approved";
  if (key === "active") return "Active";
  if (key === "declined") return "Declined";
  return status.replace(/_/g, " ");
}

export function profileStatusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "danger" {
  const key = status.toLowerCase();
  if (key === "active" || key === "approved") return "success";
  if (key === "declined") return "danger";
  if (key === "applied" || key === "under_review") return "warning";
  return "neutral";
}

export function opportunityStatusLabel(status: string): string {
  const key = status.toLowerCase();
  if (key === "not_moving_forward") return "Closed";
  if (key === "in_progress") return "In progress";
  if (key === "accepted") return "Accepted";
  if (key === "submitted") return "Submitted";
  if (key === "converted") return "Converted";
  return status.replace(/_/g, " ");
}

export function opportunityStatusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "danger" {
  const key = status.toLowerCase();
  if (key === "converted") return "success";
  if (key === "not_moving_forward") return "neutral";
  if (key === "submitted") return "warning";
  if (key === "in_progress") return "warning";
  if (key === "accepted") return "info";
  return "neutral";
}

export function referralStatusLabel(status: string): string {
  const key = status.toLowerCase();
  if (key === "referred") return "Referred";
  if (key === "in_progress") return "In progress";
  if (key === "converted") return "Converted";
  if (key === "not_converted") return "Not converted";
  return status.replace(/_/g, " ");
}

export function referralStatusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "danger" {
  const key = status.toLowerCase();
  if (key === "converted") return "success";
  if (key === "not_converted") return "neutral";
  if (key === "referred") return "warning";
  if (key === "in_progress") return "info";
  return "neutral";
}

export function referralProgramLabel(program: string): string {
  if (program === "platform" || program === "shared") return "Private Attaché";
  if (program === "whitbyos") return "Whitby";
  if (program === "academy") return "Academy";
  if (program === "enterprise") return "Enterprise";
  return program.replace(/_/g, " ");
}

export function programInterestLabel(programs: string[]): string {
  if (programs.length === 0) return "—";
  return programs
    .map((p) => {
      if (p === "academy") return "Academy";
      if (p === "platform") return "Whitby";
      if (p === "enterprise") return "Enterprise";
      return p;
    })
    .join(", ");
}

export function isApplicationQueueStatus(status: PartnerProfileStatus | string): boolean {
  const key = status.toLowerCase();
  return key === "applied" || key === "under_review";
}

export function isPartnerRosterStatus(status: PartnerProfileStatus | string): boolean {
  const key = status.toLowerCase();
  return key === "approved" || key === "active";
}
