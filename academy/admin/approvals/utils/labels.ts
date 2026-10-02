import {
  programTypeLabel,
  type AcademyProgramStatus,
  type AcademyPublishRequestStatus,
} from "@/academy/lib/domain";
import type { ApprovalQueueItem, QueueStatusFilter } from "../../types";

export function parseQueueFilter(
  value: string | string[] | undefined,
): QueueStatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "approved" || raw === "ready") return "ready";
  if (raw === "published") return "published";
  if (raw === "rejected" || raw === "returned") return "returned";
  return "pending";
}

export function approvalsQueueHref(filter: QueueStatusFilter): string {
  if (filter === "pending") return "/academy/admin/approvals";
  return `/academy/admin/approvals?status=${filter}`;
}

export function approvalStage(item: {
  status: AcademyPublishRequestStatus;
  programStatus: AcademyProgramStatus;
  publishedAt: string | null;
}): QueueStatusFilter {
  if (item.status === "pending") return "pending";
  if (item.status === "rejected") return "returned";
  if (item.publishedAt || item.programStatus === "published") return "published";
  return "ready";
}

export function approvalStageLabel(stage: QueueStatusFilter): string {
  if (stage === "pending") return "Needs review";
  if (stage === "ready") return "Ready to publish";
  if (stage === "published") return "Published";
  return "Returned for edits";
}

export function approvalRowAction(stage: QueueStatusFilter): string {
  if (stage === "pending") return "Review";
  if (stage === "ready") return "Publish";
  return "Open";
}

export function approvalQueueCopy(filter: QueueStatusFilter): string {
  if (filter === "pending") {
    return "Instructor publish requests waiting on you. Approve to unlock publishing, or return for edits — returning does not delete the program.";
  }
  if (filter === "ready") {
    return "Approved and cleared for Explore. You or the instructor can publish from the request.";
  }
  if (filter === "published") {
    return "Past requests that completed review and are live in the learner catalog.";
  }
  return "Past requests sent back for changes. They move to Needs review again when the instructor resubmits.";
}

export function formatApprovalSubmittedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (dateStart.getTime() === todayStart.getTime()) return `submitted today, ${time}`;
  if (dateStart.getTime() === yesterdayStart.getTime()) return "submitted yesterday";

  return `submitted ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}

export function approvalSubmissionTitle(item: ApprovalQueueItem): string {
  return `${item.submittedByName} — ${item.programName}`;
}

export function approvalSubmissionMeta(item: ApprovalQueueItem): string {
  const specialty = item.category.trim()
    ? `Specialty: ${item.category}`
    : programTypeLabel(item.programType);
  return `${specialty} · ${formatApprovalSubmittedAt(item.submittedAt)}`;
}

export function approvalReviewPageTitle(detail: {
  program: { name: string };
}): string {
  return detail.program.name;
}

export function approvalStatusLabel(
  status: ApprovalQueueItem["status"],
): "Needs review" | "Approved" | "Returned for edits" {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Returned for edits";
  return "Needs review";
}

export function formatApprovalReviewSubmittedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (dateStart.getTime() === todayStart.getTime()) return `Today, ${time}`;
  if (dateStart.getTime() === yesterdayStart.getTime()) return "Yesterday";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatApprovalQueueWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateStart.getTime() === todayStart.getTime()) return "Today";
  if (dateStart.getTime() === yesterdayStart.getTime()) return "Yesterday";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatApprovalActivityWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months <= 1) return "1 month ago";
  return `${months} months ago`;
}

export function approvalReviewTitle(item: {
  category: string;
  programType: ApprovalQueueItem["programType"];
  submittedByName: string;
}): string {
  const specialty = item.category.trim()
    ? item.category
    : programTypeLabel(item.programType);
  return `Specialty: ${specialty} — submitted by ${item.submittedByName}`;
}
