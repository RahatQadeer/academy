import "server-only";

import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { ACADEMY_ONBOARDING_COOKIE } from "../lib/completion";
import type { AcademyInterestId } from "../lib/interests";

export async function saveOnboardingCompletion(interestIds: AcademyInterestId[]) {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false as const };

  const userId = profile.user.id;
  const completedAt = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.from("academy_learner_profiles").upsert(
      {
        user_id: userId,
        onboarding_completed_at: completedAt,
        interest_ids: interestIds,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      return { ok: false as const };
    }
  }

  const store = await cookies();
  store.set(
    ACADEMY_ONBOARDING_COOKIE,
    JSON.stringify({
      userId,
      completed: true,
      interestIds,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 10,
    },
  );
  return { ok: true as const };
}
