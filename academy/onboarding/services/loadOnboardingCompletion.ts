import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { isAcademyAdmin, isInstructor } from "@/academy/lib/authorization";
import {
  ACADEMY_ONBOARDING_COOKIE,
  parseOnboardingRecord,
} from "../lib/completion";
import type { AcademyInterestId } from "../lib/interests";
import { ACADEMY_INTERESTS } from "../lib/interests";

function asInterestIds(value: unknown): AcademyInterestId[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AcademyInterestId =>
    typeof item === "string" && ACADEMY_INTERESTS.some((interest) => interest.id === item),
  );
}

/**
 * Fast path for AcademyEntry on every page. Cookie / profile / roles are
 * request-cached; we never upsert on the hot path (that made every navigation wait on a write).
 */
export const hasFinishedAcademyOnboarding = cache(async (userId: string): Promise<boolean> => {
  if (!userId) return true;
  if (!isSupabaseConfigured()) return true;

  // Cookie first — cheapest signal, no DB.
  const store = await cookies();
  const record = parseOnboardingRecord(store.get(ACADEMY_ONBOARDING_COOKIE)?.value, userId);
  if (record?.completed) return true;

  const actor = { id: userId };
  const [admin, instructor] = await Promise.all([
    isAcademyAdmin(actor),
    isInstructor(actor),
  ]);
  if (admin || instructor) return true;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("academy_learner_profiles")
    .select("onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.onboarding_completed_at) return true;

  const { count } = await supabase
    .from("academy_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .limit(1);

  return (count ?? 0) > 0;
});

export async function loadLearnerInterestIds(userId: string): Promise<AcademyInterestId[]> {
  if (!userId || !isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("academy_learner_profiles")
    .select("interest_ids")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.interest_ids) return asInterestIds(data.interest_ids);

  const store = await cookies();
  const record = parseOnboardingRecord(store.get(ACADEMY_ONBOARDING_COOKIE)?.value, userId);
  return record?.interestIds ?? [];
}
