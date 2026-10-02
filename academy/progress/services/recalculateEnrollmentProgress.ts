import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import type { AcademyEnrollmentStatus } from "@/academy/lib/domain";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import type { RecalculateEnrollmentProgressResult } from "../types";

type RpcEnvelope = {
  status?: string;
  reason?: string;
  progress_percent?: number;
  enrollment_status?: AcademyEnrollmentStatus;
  completed_at?: string | null;
};

export async function recalculateEnrollmentProgress(
  enrollmentId: string,
): Promise<RecalculateEnrollmentProgressResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" };
  if (!PROGRAM_ID.test(enrollmentId)) return { ok: false, reason: "not_found" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("academy_recalculate_enrollment_progress", {
      p_enrollment_id: enrollmentId,
    });

    if (error) return { ok: false, reason: "failed" };

    const envelope = (
      typeof data === "string" ? JSON.parse(data) : data
    ) as RpcEnvelope | null;

    if (!envelope || envelope.status !== "ok") {
      const reason = envelope?.reason;
      if (
        reason === "unauthenticated" ||
        reason === "no_academy_access" ||
        reason === "no_learner_capability" ||
        reason === "unauthorized" ||
        reason === "not_found"
      ) {
        return { ok: false, reason };
      }
      return { ok: false, reason: "failed" };
    }

    if (
      typeof envelope.progress_percent !== "number" ||
      (envelope.enrollment_status !== "enrolled" &&
        envelope.enrollment_status !== "in_progress" &&
        envelope.enrollment_status !== "completed")
    ) {
      return { ok: false, reason: "failed" };
    }

    return {
      ok: true,
      data: {
        progressPercent: Math.max(0, Math.min(100, envelope.progress_percent)),
        status: envelope.enrollment_status,
        completedAt: envelope.completed_at ?? null,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
