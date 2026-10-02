import "server-only";

import { createClient } from "@/base/lib/supabase/server";

/**
 * TEMPORARY helper-instructor cap (Brent’s course-builder guest).
 * Remove this module + env vars + call sites when the account is retired.
 *
 * Env:
 *   ACADEMY_TEMP_INSTRUCTOR_EMAILS=comma,separated,emails
 *   ACADEMY_TEMP_INSTRUCTOR_COURSE_CAP=10
 */

const DEFAULT_CAP = 10;

function parseEmails(): Set<string> {
  const raw = process.env.ACADEMY_TEMP_INSTRUCTOR_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function courseCap(): number {
  const raw = Number(process.env.ACADEMY_TEMP_INSTRUCTOR_COURSE_CAP ?? DEFAULT_CAP);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_CAP;
  return Math.floor(raw);
}

export function isTempCappedInstructorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseEmails().has(email.trim().toLowerCase());
}

export async function countProgramsCreatedBy(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("academy_programs")
    .select("id", { count: "exact", head: true })
    .eq("created_by_user_id", userId);
  if (error) return Number.POSITIVE_INFINITY;
  return count ?? 0;
}

export type TempInstructorQuotaResult =
  | { limited: false }
  | {
      limited: true;
      allowed: boolean;
      used: number;
      cap: number;
      message: string;
    };

/** When the signed-in user is on the temp list, enforce the course-create / Whitby gen cap. */
export async function checkTempInstructorCourseQuota(input: {
  userId: string;
  email: string | null | undefined;
}): Promise<TempInstructorQuotaResult> {
  if (!isTempCappedInstructorEmail(input.email)) {
    return { limited: false };
  }

  const cap = courseCap();
  const used = await countProgramsCreatedBy(input.userId);
  if (used >= cap) {
    return {
      limited: true,
      allowed: false,
      used,
      cap,
      message: `This temporary instructor account is limited to ${cap} courses. Limit reached (${used}/${cap}). Ask an Academy admin to raise or remove the cap.`,
    };
  }

  return {
    limited: true,
    allowed: true,
    used,
    cap,
    message: `Temporary instructor account: ${used}/${cap} courses used.`,
  };
}
