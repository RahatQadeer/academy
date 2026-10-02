import "server-only";

import type { AssignmentStats } from "../types";

type StatsRow = {
  total?: number;
  submitted?: number;
  reviewed?: number;
};

export function parseAssignmentStats(raw: unknown): AssignmentStats {
  const row = Array.isArray(raw) ? raw[0] : raw;
  const record = (row && typeof row === "object" ? row : {}) as StatsRow;
  const total = Number(record.total ?? 0);
  const submitted = Number(record.submitted ?? 0);
  const reviewed = Number(record.reviewed ?? 0);
  return {
    total: Number.isFinite(total) ? total : 0,
    submitted: Number.isFinite(submitted) ? submitted : 0,
    reviewed: Number.isFinite(reviewed) ? reviewed : 0,
  };
}

export function certificateLockReason(stats: AssignmentStats): string | null {
  if (stats.total === 0 || stats.reviewed >= stats.total) return null;
  if (stats.submitted < stats.total) {
    return "Submit every required assignment before your certificate can be issued.";
  }
  return "Your certificate will be available after all assignments have been reviewed by your instructor.";
}

export function isCertificateLockedByAssignments(stats: AssignmentStats): boolean {
  return stats.total > 0 && stats.reviewed < stats.total;
}
