import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAcademy,
  canAccessLearnerArea,
} from "@/academy/lib/authorization";
import type {
  AcademyCourseAccess,
  AcademyEnrollment,
  AcademyEntitlementSource,
  AcademyEnrollmentStatus,
  AcademyProgramType,
} from "@/academy/lib/domain";
import { prerequisiteSatisfied } from "../lib/prerequisite";
import { isPaidProgram } from "@/academy/lib/learnerProgramAccess";
import { allowsSelfPurchase } from "@/academy/lib/programAccessPolicy";
import type { FreeEnrollmentResult } from "../types";

const PROGRAM_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProgramRow = {
  id: string;
  type: AcademyProgramType;
  access: AcademyCourseAccess;
  price: number | string | null;
  status: "draft" | "pending_approval" | "published";
  prerequisite_program_id: string | null;
};

type EnrollmentRow = {
  id: string;
  user_id: string;
  program_id: string;
  status: AcademyEnrollmentStatus;
  progress_percent: number;
  entitlement_source: AcademyEntitlementSource | null;
  enrolled_at: string;
  completed_at: string | null;
};

const ENROLLMENT_COLUMNS =
  "id, user_id, program_id, status, progress_percent, entitlement_source, enrolled_at, completed_at";

function asEnrollment(row: EnrollmentRow): AcademyEnrollment {
  return {
    id: row.id,
    user_id: row.user_id,
    program_id: row.program_id,
    status: row.status,
    progress_percent: row.progress_percent,
    entitlement_source: row.entitlement_source,
    enrolled_at: row.enrolled_at,
    completed_at: row.completed_at,
  };
}

async function loadExistingEnrollment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  programId: string,
): Promise<AcademyEnrollment | null> {
  const { data } = await supabase
    .from("academy_enrollments")
    .select(ENROLLMENT_COLUMNS)
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();

  return data ? asEnrollment(data as EnrollmentRow) : null;
}

export async function enrollInFreeProgram(programId: string): Promise<FreeEnrollmentResult> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable", reason: "failed" };
  }
  if (typeof programId !== "string" || !PROGRAM_ID.test(programId)) {
    return { status: "unavailable", reason: "not_found" };
  }

  const profile = await getSessionProfile();
  if (!profile) {
    return { status: "unavailable", reason: "unauthenticated" };
  }

  const user = { id: profile.user.id };
  if (!(await canAccessAcademy(user))) {
    return { status: "unavailable", reason: "no_academy_access" };
  }
  if (!(await canAccessLearnerArea(user))) {
    return { status: "unavailable", reason: "no_learner_capability" };
  }

  try {
    const supabase = await createClient();

    const existing = await loadExistingEnrollment(supabase, user.id, programId);
    if (existing) {
      return { status: "already_enrolled", enrollment: existing };
    }

    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select("id, type, access, price, status, prerequisite_program_id")
      .eq("id", programId)
      .maybeSingle();

    if (programError) return { status: "unavailable", reason: "failed" };
    if (!program) return { status: "unavailable", reason: "not_found" };

    const row = program as ProgramRow;
    if (row.status !== "published") {
      return { status: "unavailable", reason: "unpublished" };
    }
    // Purchased access with a real price → checkout. $0 / null price may Start.
    if (isPaidProgram(row.price) && allowsSelfPurchase(row.access)) {
      return { status: "unavailable", reason: "paid" };
    }
    if (!(await prerequisiteSatisfied(supabase, user.id, row))) {
      return { status: "unavailable", reason: "prerequisite_unmet" };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("academy_enrollments")
      .insert({
        user_id: user.id,
        program_id: programId,
        status: "enrolled",
        progress_percent: 0,
        entitlement_source: "free",
        completed_at: null,
      })
      .select(ENROLLMENT_COLUMNS)
      .single();

    if (insertError?.code === "23505") {
      const raced = await loadExistingEnrollment(supabase, user.id, programId);
      if (raced) return { status: "already_enrolled", enrollment: raced };
      return { status: "unavailable", reason: "failed" };
    }

    if (insertError || !inserted) {
      return { status: "unavailable", reason: "failed" };
    }

    const enrollment = asEnrollment(inserted as EnrollmentRow);
    try {
      const { createAdminClient: createPartnerAdmin } = await import(
        "@/partner-center/lib/supabase-admin"
      );
      const { recordQualifyingAction } = await import(
        "@/partner-center/lib/attribution"
      );
      const partnerDb = createPartnerAdmin();
      if (partnerDb) {
        await recordQualifyingAction(partnerDb, {
          referredUserId: enrollment.user_id,
          product: "academy",
          qualifyingAction: "free_enrollment",
          commissionable: false,
          eventSource: "manual",
          productId: enrollment.program_id,
          externalPaymentId: `academy_free_${enrollment.id}`,
        });
      } else {
        const { notifyPartnerAcademyAttribution } = await import(
          "@/academy/lib/notifyPartnerAttribution"
        );
        await notifyPartnerAcademyAttribution({
          referredUserId: enrollment.user_id,
          qualifyingAction: "free_enrollment",
          commissionable: false,
          eventSource: "manual",
          productId: enrollment.program_id,
          externalPaymentId: `academy_free_${enrollment.id}`,
        });
      }
    } catch {
      // Attribution must never block enrollment.
    }

    return { status: "enrolled", enrollment };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}
