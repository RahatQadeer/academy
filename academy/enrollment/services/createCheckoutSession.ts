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
import { allowsSelfPurchase } from "@/academy/lib/programAccessPolicy";
import type { CheckoutSessionSummary, CreateCheckoutResult } from "../types";

const PROGRAM_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHECKOUT_TTL_HOURS = 24;

type ProgramRow = {
  id: string;
  name: string;
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

type CheckoutRow = {
  id: string;
  program_id: string;
  amount: number | string;
  currency: string;
  status: string;
  stripe_checkout_session_id: string | null;
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

function asCheckout(row: CheckoutRow, programName: string): CheckoutSessionSummary {
  return {
    id: row.id,
    programId: row.program_id,
    programName,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status as CheckoutSessionSummary["status"],
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
  };
}

function checkoutExpiresAt() {
  return new Date(Date.now() + CHECKOUT_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export async function createCheckoutSession(programId: string): Promise<CreateCheckoutResult> {
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

    const { data: existingEnrollment } = await supabase
      .from("academy_enrollments")
      .select(ENROLLMENT_COLUMNS)
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .maybeSingle();

    if (existingEnrollment) {
      return {
        status: "already_enrolled",
        enrollment: asEnrollment(existingEnrollment as EnrollmentRow),
      };
    }

    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select("id, name, type, access, price, status, prerequisite_program_id")
      .eq("id", programId)
      .maybeSingle();

    if (programError) return { status: "unavailable", reason: "failed" };
    if (!program) return { status: "unavailable", reason: "not_found" };

    const row = program as ProgramRow;
    if (row.status !== "published") {
      return { status: "unavailable", reason: "unpublished" };
    }

    const amount = row.price == null ? null : Number(row.price);
    if (amount == null || amount <= 0) {
      return { status: "unavailable", reason: "free_program" };
    }
    // Only Purchased access may self-serve checkout.
    if (!allowsSelfPurchase(row.access)) {
      return { status: "unavailable", reason: "free_program" };
    }

    if (!(await prerequisiteSatisfied(supabase, user.id, row))) {
      return { status: "unavailable", reason: "prerequisite_unmet" };
    }

    const { data: pendingCheckout } = await supabase
      .from("academy_checkout_sessions")
      .select("id, program_id, amount, currency, status, stripe_checkout_session_id")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingCheckout) {
      const pending = pendingCheckout as CheckoutRow;
      if (Number(pending.amount) === amount) {
        return {
          status: "existing",
          checkout: asCheckout(pending, row.name),
        };
      }

      await supabase
        .from("academy_checkout_sessions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", pending.id);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("academy_checkout_sessions")
      .insert({
        user_id: user.id,
        program_id: programId,
        amount,
        currency: "usd",
        status: "pending",
        expires_at: checkoutExpiresAt(),
      })
      .select("id, program_id, amount, currency, status, stripe_checkout_session_id")
      .single();

    if (insertError?.code === "23505") {
      const { data: raced } = await supabase
        .from("academy_checkout_sessions")
        .select("id, program_id, amount, currency, status, stripe_checkout_session_id")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .eq("status", "pending")
        .maybeSingle();
      if (raced) {
        return {
          status: "existing",
          checkout: asCheckout(raced as CheckoutRow, row.name),
        };
      }
      return { status: "unavailable", reason: "failed" };
    }

    if (insertError || !inserted) {
      return { status: "unavailable", reason: "failed" };
    }

    return {
      status: "created",
      checkout: asCheckout(inserted as CheckoutRow, row.name),
    };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}
